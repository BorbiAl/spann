package hub

import (
	"context"
	"time"

	"spann/chat-server/models"

	"github.com/google/uuid"
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
func (h *Hub) BroadcastMessage(ctx context.Context, channelID string, event models.ServerEvent) {
	h.BroadcastChannel(ctx, channelID, event)
}
