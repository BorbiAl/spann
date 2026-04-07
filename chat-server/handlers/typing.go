package handlers

import (
	"sort"
	"strings"
	"sync"

	"spann/chat-server/hub"
	"spann/chat-server/models"
)

// TypingTracker holds active typing users per channel.
type TypingTracker struct {
	mu       sync.Mutex
	channels map[string]map[string]struct{}
}

// NewTypingTracker creates a tracker used for typing indicator fanout.
func NewTypingTracker() *TypingTracker {
	return &TypingTracker{channels: make(map[string]map[string]struct{})}
}

// RemoveUser removes a disconnected user from all typing states.
func (t *TypingTracker) RemoveUser(userID string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	for channelID, members := range t.channels {
		delete(members, userID)
		if len(members) == 0 {
			delete(t.channels, channelID)
		}
	}
}

func (t *TypingTracker) setTyping(channelID string, userID string, enabled bool) []string {
	t.mu.Lock()
	defer t.mu.Unlock()

	members, exists := t.channels[channelID]
	if !exists {
		members = make(map[string]struct{})
		t.channels[channelID] = members
	}

	if enabled {
		members[userID] = struct{}{}
	} else {
		delete(members, userID)
		if len(members) == 0 {
			delete(t.channels, channelID)
		}
	}

	users := make([]string, 0, len(members))
	for user := range members {
		users = append(users, user)
	}
	sort.Strings(users)
	return users
}

// HandleTypingEvent updates typing state and broadcasts current typers.
func HandleTypingEvent(h *WSHandler, client *hub.Client, event models.ClientEvent) {
	channelID := strings.TrimSpace(event.ChannelID)
	if channelID == "" {
		client.SendError(4005, "channelId is required for typing events")
		return
	}

	h.Hub.JoinChannel(client, channelID)
	enabled := event.Event == "typing:start"
	users := h.TypingTracker.setTyping(channelID, client.UserID, enabled)

	h.Hub.BroadcastChannel(client.Context, channelID, models.ServerEvent{
		Event:     "typing:update",
		ChannelID: channelID,
		Users:     users,
	})
}
