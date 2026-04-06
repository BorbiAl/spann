package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	goredis "github.com/go-redis/redis/v9"
	"spann/chat-server/config"
	"spann/chat-server/handlers"
	"spann/chat-server/hub"
	"spann/chat-server/models"
	redisadapter "spann/chat-server/redis"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg := config.Load()

	if strings.TrimSpace(cfg.JWTSecret) == "" {
		logger.Error("JWT_SECRET is required")
		os.Exit(1)
	}

	redisOptions, err := goredis.ParseURL(cfg.RedisURL)
	if err != nil {
		logger.Error("invalid REDIS_URL", "error", err.Error())
		os.Exit(1)
	}
	redisClient := goredis.NewClient(redisOptions)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		logger.Error("redis_ping_failed", "error", err.Error())
		os.Exit(1)
	}

	pubsub := redisadapter.NewPubSubAdapter(redisClient, redisadapter.DefaultPubSubChannel, logger)
	channelHub := hub.New(logger, pubsub)
	if err := channelHub.Start(ctx); err != nil {
		logger.Error("hub_start_failed", "error", err.Error())
		os.Exit(1)
	}
	if err := subscribeAuxiliaryEvents(ctx, redisClient, channelHub, logger); err != nil {
		logger.Error("auxiliary_pubsub_start_failed", "error", err.Error())
		os.Exit(1)
	}

	presence := redisadapter.NewPresenceStore(redisClient)
	allowedOrigins := splitCSV(os.Getenv("ALLOWED_ORIGINS"))
	wsHandler := handlers.NewWSHandler(channelHub, presence, cfg, logger, allowedOrigins)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", wsHandler.ServeWS)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	server := &http.Server{
		Addr:         cfg.Addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("chat_server_starting", "addr", cfg.Addr)
		if serveErr := server.ListenAndServe(); serveErr != nil && serveErr != http.ErrServerClosed {
			logger.Error("chat_server_failed", "error", serveErr.Error())
			os.Exit(1)
		}
	}()

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	<-signals

	logger.Info("chat_server_stopping")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("chat_server_shutdown_failed", "error", err.Error())
	}

	_ = redisClient.Close()
	logger.Info("chat_server_stopped")
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func subscribeAuxiliaryEvents(
	ctx context.Context,
	redisClient *goredis.Client,
	channelHub *hub.Hub,
	logger *slog.Logger,
) error {
	pubsub := redisClient.PSubscribe(ctx, "coaching:*", "pulse:*")
	if _, err := pubsub.Receive(ctx); err != nil {
		return err
	}

	go func() {
		defer pubsub.Close()
		channel := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case message, ok := <-channel:
				if !ok {
					return
				}
				handleAuxiliaryEvent(message, channelHub, logger)
			}
		}
	}()

	return nil
}

func handleAuxiliaryEvent(
	message *goredis.Message,
	channelHub *hub.Hub,
	logger *slog.Logger,
) {
	var event models.ServerEvent
	if err := json.Unmarshal([]byte(message.Payload), &event); err != nil {
		logger.Warn("auxiliary_event_unmarshal_failed", "channel", message.Channel, "error", err.Error())
		return
	}

	if strings.HasPrefix(message.Channel, "coaching:") {
		channelID := strings.TrimPrefix(message.Channel, "coaching:")
		if event.Event == "" {
			event.Event = "coaching:nudge"
		}
		if event.ChannelID == "" {
			event.ChannelID = channelID
		}
		channelHub.BroadcastLocalChannel(channelID, event)
		return
	}

	if strings.HasPrefix(message.Channel, "pulse:") {
		channelID := strings.TrimPrefix(message.Channel, "pulse:")
		if event.Event == "" {
			event.Event = "pulse:update"
		}
		if event.ChannelID == "" {
			event.ChannelID = channelID
		}
		channelHub.BroadcastLocalChannel(channelID, event)
	}
}
