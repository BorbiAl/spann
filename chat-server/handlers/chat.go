package handlers

import (
	"strings"
	"time"

	"spann/chat-server/hub"
	"spann/chat-server/models"
)

// HandleMessageSend validates payload and broadcasts message:new events.
func HandleMessageSend(h *WSHandler, client *hub.Client, event models.ClientEvent) {
	channelID := strings.TrimSpace(event.ChannelID)
	text := strings.TrimSpace(event.Text)

	if channelID == "" {
		client.SendError(4002, "channelId is required for message:send")
		return
	}
	if text == "" {
		client.SendError(4003, "text is required for message:send")
		return
	}
	if int64(len([]byte(text))) > h.Config.MessageByteLimit {
		client.SendError(4004, "message exceeds 4096 byte limit")
		return
	}
	if !client.AllowMessageSend(time.Now().UTC()) {
		client.SendError(4290, "rate limit exceeded: max 60 messages per minute")
		return
	}

	h.Hub.JoinChannel(client, channelID)
	serverEvent := hub.BuildMessageEvent(channelID, client.UserID, client.UserName, text)
	h.Hub.BroadcastMessage(client.Context, channelID, serverEvent)
}
