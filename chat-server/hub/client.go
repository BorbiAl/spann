package hub

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gorilla/websocket"
	"spann/chat-server/models"
)

// Client is one websocket connection with read and write goroutines.
type Client struct {
	Conn            *websocket.Conn
	Hub             *Hub
	Logger          *slog.Logger
	Send            chan []byte
	UserID          string
	UserName        string
	Channels        map[string]bool
	MessageByteLimit int64
	PingPeriod      time.Duration
	PongWait        time.Duration
	WriteWait       time.Duration
}

// NewClient builds a websocket client with heartbeat and write buffer defaults.
func NewClient(
	conn *websocket.Conn,
	hub *Hub,
	logger *slog.Logger,
	userID string,
	userName string,
	messageByteLimit int64,
	pingPeriod time.Duration,
	pongWait time.Duration,
	writeWait time.Duration,
) *Client {
	return &Client{
		Conn:            conn,
		Hub:             hub,
		Logger:          logger,
		Send:            make(chan []byte, 256),
		UserID:          userID,
		UserName:        userName,
		Channels:        make(map[string]bool),
		MessageByteLimit: messageByteLimit,
		PingPeriod:      pingPeriod,
		PongWait:        pongWait,
		WriteWait:       writeWait,
	}
}

// ReadPump reads inbound events and dispatches them to handlers.
func (c *Client) ReadPump(dispatch func(*Client, models.ClientEvent), onClose func(*Client)) {
	defer onClose(c)

	c.Conn.SetReadLimit(c.MessageByteLimit)
	_ = c.Conn.SetReadDeadline(time.Now().Add(c.PongWait))
	c.Conn.SetPongHandler(func(_ string) error {
		return c.Conn.SetReadDeadline(time.Now().Add(c.PongWait))
	})

	for {
		_, payload, err := c.Conn.ReadMessage()
		if err != nil {
			c.Logger.Warn("ws_read_failed", "user_id", c.UserID, "error", err.Error())
			return
		}

		var event models.ClientEvent
		if err := json.Unmarshal(payload, &event); err != nil {
			c.SendError(4000, "Malformed event payload")
			continue
		}

		dispatch(c, event)
	}
}

// WritePump writes outbound events and heartbeat pings.
func (c *Client) WritePump() {
	ticker := time.NewTicker(c.PingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.Conn.Close()
	}()

	for {
		select {
		case payload, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(c.WriteWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				c.Logger.Warn("ws_write_failed", "user_id", c.UserID, "error", err.Error())
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(c.WriteWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.Logger.Warn("ws_ping_failed", "user_id", c.UserID, "error", err.Error())
				return
			}
		}
	}
}

// SendError enqueues a typed websocket error event.
func (c *Client) SendError(code int, message string) {
	event := models.ServerEvent{Event: "error", Code: code, Message: message}
	payload, err := json.Marshal(event)
	if err != nil {
		c.Logger.Error("error_event_marshal_failed", "error", err.Error())
		return
	}
	select {
	case c.Send <- payload:
	default:
		c.Logger.Warn("client_error_queue_full", "user_id", c.UserID)
	}
}
