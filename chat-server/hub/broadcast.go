package hub

import (
	"context"
	"time"

	"github.com/google/uuid"
	"spann/chat-server/models"
)

// BuildMessageEvent creates a typed message:new server event.
func BuildMessageEvent(channelID string, userID string, userName string, text string) models.ServerEvent {
	return models.ServerEvent{
		Event:          "message:new",
		ID:             uuid.NewString(),
		ChannelID:      channelID,
		User:           &models.UserRef{ID: userID, Name: userName},
		Text:           text,
		Translated:     "",
		SentimentScore: 0.0,
		MeshOrigin:     false,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339Nano),
	}
}

// BroadcastMessage fans out a newly created message event.
func (h *Hub) BroadcastMessage(channelID string, event models.ServerEvent) {
	h.BroadcastChannel(context.Background(), channelID, event)
}
