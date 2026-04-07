package handlers

import (
	"log/slog"
	"net/http"
	"strings"

	"spann/chat-server/config"
	"spann/chat-server/hub"
	"spann/chat-server/middleware"
	"spann/chat-server/models"
	redisstore "spann/chat-server/redis"

	"github.com/gorilla/websocket"
)

// WSHandler manages websocket upgrades and client lifecycle.
type WSHandler struct {
	Hub           *hub.Hub
	Config        config.Config
	Presence      *redisstore.PresenceStore
	TypingTracker *TypingTracker
	Logger        *slog.Logger
	allowedOrigin map[string]struct{}
}

func (h *WSHandler) isOriginAllowed(req *http.Request) bool {
	origin := strings.TrimSpace(req.Header.Get("Origin"))
	if origin == "" {
		// Non-browser clients generally do not send Origin.
		return true
	}
	if len(h.allowedOrigin) == 0 {
		return false
	}
	_, ok := h.allowedOrigin[origin]
	return ok
}

// NewWSHandler creates a websocket handler with event dispatch dependencies.
func NewWSHandler(
	h *hub.Hub,
	presence *redisstore.PresenceStore,
	cfg config.Config,
	logger *slog.Logger,
	allowedOrigins []string,
) *WSHandler {
	originMap := make(map[string]struct{})
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed != "" {
			originMap[trimmed] = struct{}{}
		}
	}

	return &WSHandler{
		Hub:           h,
		Config:        cfg,
		Presence:      presence,
		TypingTracker: NewTypingTracker(),
		Logger:        logger,
		allowedOrigin: originMap,
	}
}

// ServeWS upgrades authenticated requests to websocket connections.
func (h *WSHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.ValidateWSJWT(r, h.Config.JWTSecret)
	if err != nil {
		h.Logger.Warn("ws_auth_failed", "error", err.Error())
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     h.isOriginAllowed,
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.Logger.Error("ws_upgrade_failed", "error", err.Error())
		return
	}

	client := hub.NewClient(
		r.Context(),
		conn,
		h.Hub,
		h.Logger,
		claims.UserID,
		claims.Name,
		h.Config.MessageByteLimit,
		h.Config.MessageRatePerMin,
		h.Config.PingPeriod,
		h.Config.PongWait,
		h.Config.WriteWait,
	)

	h.Hub.Register(client)
	channelID := strings.TrimSpace(r.URL.Query().Get("channelId"))
	if channelID != "" {
		h.Hub.JoinChannel(client, channelID)
	}

	h.onConnect(client)

	go client.WritePump()
	go client.ReadPump(h.dispatchEvent, h.onDisconnect)
}

func (h *WSHandler) dispatchEvent(client *hub.Client, event models.ClientEvent) {
	switch event.Event {
	case "message:send":
		HandleMessageSend(h, client, event)
	case "typing:start", "typing:stop":
		HandleTypingEvent(h, client, event)
	case "presence:ping":
		HandlePresencePing(h, client)
	default:
		client.SendError(4001, "Unsupported event type")
	}
}

func (h *WSHandler) onConnect(client *hub.Client) {
	ctx := client.Context
	if err := h.Presence.SetStatus(ctx, client.UserID, "online"); err != nil {
		h.Logger.Warn("presence_online_failed", "user_id", client.UserID, "error", err.Error())
	}

	h.Hub.BroadcastAll(ctx, models.ServerEvent{
		Event:  "presence:update",
		UserID: client.UserID,
		Status: "online",
	})
}

func (h *WSHandler) onDisconnect(client *hub.Client) {
	ctx := client.Context
	h.Hub.Unregister(client)
	h.TypingTracker.RemoveUser(client.UserID)

	if err := h.Presence.SetStatus(ctx, client.UserID, "offline"); err != nil {
		h.Logger.Warn("presence_offline_failed", "user_id", client.UserID, "error", err.Error())
	}

	h.Hub.BroadcastAll(ctx, models.ServerEvent{
		Event:  "presence:update",
		UserID: client.UserID,
		Status: "offline",
	})
}
