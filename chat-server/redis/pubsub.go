package redis

import (
	"context"
	"encoding/json"
	"log/slog"

	goredis "github.com/go-redis/redis/v9"
	"spann/chat-server/models"
)

const DefaultPubSubChannel = "spann:events"

// PubSubAdapter bridges websocket events across chat server instances.
type PubSubAdapter struct {
	client  *goredis.Client
	channel string
	logger  *slog.Logger
	handler func(models.ServerEvent)
}

// NewPubSubAdapter creates a Redis event adapter.
func NewPubSubAdapter(client *goredis.Client, channel string, logger *slog.Logger) *PubSubAdapter {
	if channel == "" {
		channel = DefaultPubSubChannel
	}
	return &PubSubAdapter{
		client:  client,
		channel: channel,
		logger:  logger,
	}
}

// Publish sends an event into Redis for other chat server instances.
func (a *PubSubAdapter) Publish(ctx context.Context, event models.ServerEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return a.client.Publish(ctx, a.channel, payload).Err()
}

// SetHandler registers callback for inbound Redis events.
func (a *PubSubAdapter) SetHandler(handler func(models.ServerEvent)) {
	a.handler = handler
}

// Start begins Redis subscription loop.
func (a *PubSubAdapter) Start(ctx context.Context) error {
	pubsub := a.client.Subscribe(ctx, a.channel)
	if _, err := pubsub.Receive(ctx); err != nil {
		return err
	}

	go func() {
		defer pubsub.Close()
		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}

				if a.handler == nil {
					continue
				}

				var event models.ServerEvent
				if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
					a.logger.Warn("redis_event_unmarshal_failed", "error", err.Error())
					continue
				}
				a.handler(event)
			}
		}
	}()

	return nil
}
