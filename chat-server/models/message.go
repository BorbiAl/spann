package models

// UserRef is the minimal user object sent over realtime events.
type UserRef struct {
	ID    string `json:"id"`
	Name  string `json:"name,omitempty"`
	Locale string `json:"locale,omitempty"`
}

// ChatMessage models the message:new payload.
type ChatMessage struct {
	ID             string  `json:"id"`
	ChannelID      string  `json:"channelId"`
	User           UserRef `json:"user"`
	Text           string  `json:"text"`
	Translated     string  `json:"translated,omitempty"`
	SentimentScore float64 `json:"sentimentScore"`
	MeshOrigin     bool    `json:"meshOrigin"`
	CreatedAt      string  `json:"createdAt"`
}
