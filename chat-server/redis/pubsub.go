package redis

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"spann/chat-server/models"

	goredis "github.com/redis/go-redis/v9"
)

const DefaultPubSubChannel = "spann:events"

// PubSubAdapter bridges websocket events across chat server instances.
type PubSubAdapter struct {
	client  *goredis.Client
	channel string
	logger  *slog.Logger
	handler func(models.ServerEvent)
}

// NewPubSubAdapter creates a Redis event adapter.
func NewPubSubAdapter(client *goredis.Client, channel string, logger *slog.Logger) *PubSubAdapter {
	if channel == "" {
		channel = DefaultPubSubChannel
	}
	return &PubSubAdapter{
		client:  client,
		channel: channel,
		logger:  logger,
	}
}

// Publish sends an event into Redis for other chat server instances.
func (a *PubSubAdapter) Publish(ctx context.Context, event models.ServerEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return a.client.Publish(ctx, a.channel, payload).Err()
}

// SetHandler registers callback for inbound Redis events.
func (a *PubSubAdapter) SetHandler(handler func(models.ServerEvent)) {
	a.handler = handler
}

// Start begins Redis subscription loop.
func (a *PubSubAdapter) Start(ctx context.Context) error {
	go func() {
		backoff := time.Second
		for {
			if ctx.Err() != nil {
				return
			}

			pubsub := a.client.Subscribe(ctx, a.channel)
			if _, err := pubsub.Receive(ctx); err != nil {
				a.logger.Warn("redis_subscribe_failed", "channel", a.channel, "error", err.Error(), "backoff_seconds", backoff.Seconds())
				_ = pubsub.Close()
				select {
				case <-ctx.Done():
					return
				case <-time.After(backoff):
				}
				if backoff < 30*time.Second {
					backoff *= 2
				}
				continue
			}

			backoff = time.Second
			ch := pubsub.Channel()
			running := true
			for running {
				select {
				case <-ctx.Done():
					running = false
				case msg, ok := <-ch:
					if !ok {
						a.logger.Warn("redis_subscription_closed", "channel", a.channel)
						running = false
						break
					}

					if a.handler == nil {
						continue
					}

					var event models.ServerEvent
					if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
						a.logger.Warn("redis_event_unmarshal_failed", "error", err.Error())
						continue
					}
					a.handler(event)
				}
			}

			_ = pubsub.Close()
			if ctx.Err() != nil {
				return
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			if backoff < 30*time.Second {
				backoff *= 2
			}
		}
	}()

	return nil
}
