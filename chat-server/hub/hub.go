package hub

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"spann/chat-server/models"
)

// PubSubAdapter defines the Redis pub/sub methods used by the hub.
type PubSubAdapter interface {
	Publish(ctx context.Context, event models.ServerEvent) error
	SetHandler(handler func(models.ServerEvent))
	Start(ctx context.Context) error
}

// Hub stores websocket clients by channel and performs fanout.
type Hub struct {
	logger   *slog.Logger
	pubsub   PubSubAdapter
	mu       sync.RWMutex
	clients  map[*Client]struct{}
	channels map[string]map[*Client]struct{}
}

// New creates a channel fanout hub.
func New(logger *slog.Logger, pubsub PubSubAdapter) *Hub {
	h := &Hub{
		logger:   logger,
		pubsub:   pubsub,
		clients:  make(map[*Client]struct{}),
		channels: make(map[string]map[*Client]struct{}),
	}

	if pubsub != nil {
		pubsub.SetHandler(func(event models.ServerEvent) {
			h.broadcastLocal(event.ChannelID, event)
		})
	}

	return h
}

// Start launches external pub/sub listeners.
func (h *Hub) Start(ctx context.Context) error {
	if h.pubsub == nil {
		return nil
	}
	return h.pubsub.Start(ctx)
}

// Register adds a websocket client to the active registry.
func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client] = struct{}{}
}

// Unregister removes a websocket client and all of its subscriptions.
func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.clients[client]; !exists {
		return
	}

	delete(h.clients, client)
	for channelID, members := range h.channels {
		delete(members, client)
		if len(members) == 0 {
			delete(h.channels, channelID)
		}
	}

	close(client.Send)
}

// JoinChannel subscribes a client to one channel.
func (h *Hub) JoinChannel(client *Client, channelID string) {
	if channelID == "" {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	members, exists := h.channels[channelID]
	if !exists {
		members = make(map[*Client]struct{})
		h.channels[channelID] = members
	}
	members[client] = struct{}{}
	client.Channels[channelID] = true
}

// LeaveChannel unsubscribes a client from one channel.
func (h *Hub) LeaveChannel(client *Client, channelID string) {
	if channelID == "" {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if members, exists := h.channels[channelID]; exists {
		delete(members, client)
		if len(members) == 0 {
			delete(h.channels, channelID)
		}
	}
	delete(client.Channels, channelID)
}

// BroadcastChannel sends an event to local subscribers and Redis peers.
func (h *Hub) BroadcastChannel(ctx context.Context, channelID string, event models.ServerEvent) {
	event.ChannelID = channelID
	h.broadcastLocal(channelID, event)

	if h.pubsub != nil {
		if err := h.pubsub.Publish(ctx, event); err != nil {
			h.logger.Error("redis_publish_failed", "error", err.Error(), "event", event.Event)
		}
	}
}

// BroadcastAll sends an event to all connected clients and Redis peers.
func (h *Hub) BroadcastAll(ctx context.Context, event models.ServerEvent) {
	h.broadcastLocal("", event)
	if h.pubsub != nil {
		if err := h.pubsub.Publish(ctx, event); err != nil {
			h.logger.Error("redis_publish_failed", "error", err.Error(), "event", event.Event)
		}
	}
}

// BroadcastLocalChannel sends a channel event to local websocket clients only.
func (h *Hub) BroadcastLocalChannel(channelID string, event models.ServerEvent) {
	event.ChannelID = channelID
	h.broadcastLocal(channelID, event)
}

// BroadcastLocalAll sends an event to all local websocket clients only.
func (h *Hub) BroadcastLocalAll(event models.ServerEvent) {
	h.broadcastLocal("", event)
}

func (h *Hub) broadcastLocal(channelID string, event models.ServerEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		h.logger.Error("event_marshal_failed", "error", err.Error(), "event", event.Event)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if channelID == "" {
		for client := range h.clients {
			h.enqueue(client, payload)
		}
		return
	}

	members, exists := h.channels[channelID]
	if !exists {
		return
	}

	for client := range members {
		h.enqueue(client, payload)
	}
}

func (h *Hub) enqueue(client *Client, payload []byte) {
	select {
	case client.Send <- payload:
	default:
		h.logger.Warn("client_send_queue_full", "user_id", client.UserID)
	}
}
