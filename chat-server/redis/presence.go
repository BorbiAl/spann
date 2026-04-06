package redis

import (
	"context"
	"time"

	goredis "github.com/go-redis/redis/v9"
)

const (
	presencePrefix = "spann:presence:"
	defaultTTL     = 90 * time.Second
)

// PresenceStore tracks online/offline status in Redis.
type PresenceStore struct {
	client *goredis.Client
	ttl    time.Duration
}

// NewPresenceStore creates a Redis-backed presence store.
func NewPresenceStore(client *goredis.Client) *PresenceStore {
	return &PresenceStore{client: client, ttl: defaultTTL}
}

// SetStatus stores one user's status with expiration.
func (s *PresenceStore) SetStatus(ctx context.Context, userID string, status string) error {
	return s.client.Set(ctx, presencePrefix+userID, status, s.ttl).Err()
}

// Touch marks user as online and refreshes expiration.
func (s *PresenceStore) Touch(ctx context.Context, userID string) error {
	return s.SetStatus(ctx, userID, "online")
}

// GetStatus fetches one user's status; defaults to offline.
func (s *PresenceStore) GetStatus(ctx context.Context, userID string) (string, error) {
	value, err := s.client.Get(ctx, presencePrefix+userID).Result()
	if err == goredis.Nil {
		return "offline", nil
	}
	if err != nil {
		return "offline", err
	}
	return value, nil
}
