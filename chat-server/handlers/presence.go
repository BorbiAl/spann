package handlers

import (
	"spann/chat-server/hub"
	"spann/chat-server/models"
)

// HandlePresencePing refreshes presence TTL and emits online status.
func HandlePresencePing(h *WSHandler, client *hub.Client) {
	ctx := client.Context
	if err := h.Presence.Touch(ctx, client.UserID); err != nil {
		h.Logger.Warn("presence_ping_failed", "user_id", client.UserID, "error", err.Error())
		client.SendError(5001, "presence refresh failed")
		return
	}

	h.Hub.BroadcastAll(ctx, models.ServerEvent{
		Event:  "presence:update",
		UserID: client.UserID,
		Status: "online",
	})
}
