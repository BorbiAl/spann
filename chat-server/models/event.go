package models

// ClientEvent represents inbound websocket payloads.
type ClientEvent struct {
	Event     string `json:"event"`
	ChannelID string `json:"channelId,omitempty"`
	Text      string `json:"text,omitempty"`
}

// ServerEvent represents outbound websocket payloads.
type ServerEvent struct {
	Event         string   `json:"event"`
	ID            string   `json:"id,omitempty"`
	ChannelID     string   `json:"channelId,omitempty"`
	MessageID     string   `json:"messageId,omitempty"`
	User          *UserRef `json:"user,omitempty"`
	Text          string   `json:"text,omitempty"`
	Translated    string   `json:"translated,omitempty"`
	SentimentScore float64 `json:"sentimentScore,omitempty"`
	MeshOrigin    bool     `json:"meshOrigin,omitempty"`
	CreatedAt     string   `json:"createdAt,omitempty"`
	Emoji         string   `json:"emoji,omitempty"`
	UserID        string   `json:"userId,omitempty"`
	Users         []string `json:"users,omitempty"`
	Status        string   `json:"status,omitempty"`
	Score         float64  `json:"score,omitempty"`
	Label         string   `json:"label,omitempty"`
	Nudge         string   `json:"nudge,omitempty"`
	Severity      string   `json:"severity,omitempty"`
	NodeID        string   `json:"nodeId,omitempty"`
	Name          string   `json:"name,omitempty"`
	Signal        int      `json:"signal,omitempty"`
	Code          int      `json:"code,omitempty"`
	Message       string   `json:"message,omitempty"`
}
