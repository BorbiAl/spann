package hub

import (
	"context"
	"strings"
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
		SentimentScore: estimateSentimentScore(text),
		MeshOrigin:     false,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339Nano),
	}
}

func estimateSentimentScore(text string) float64 {
	lowerText := strings.ToLower(strings.TrimSpace(text))
	if lowerText == "" {
		return 50
	}

	positiveTerms := []string{"thanks", "great", "awesome", "good", "nice", "please", "appreciate", "love", "helpful", "perfect"}
	negativeTerms := []string{"urgent", "asap", "problem", "issue", "broken", "bad", "angry", "frustrated", "hate", "fail"}

	score := 50.0
	for _, token := range positiveTerms {
		if strings.Contains(lowerText, token) {
			score += 8
		}
	}
	for _, token := range negativeTerms {
		if strings.Contains(lowerText, token) {
			score -= 8
		}
	}

	if score < 0 {
		return 0
	}
	if score > 100 {
		return 100
	}
	return score
}

// BroadcastMessage fans out a newly created message event.
func (h *Hub) BroadcastMessage(ctx context.Context, channelID string, event models.ServerEvent) {
	h.BroadcastChannel(ctx, channelID, event)
}
