package config

import (
	"os"
	"strconv"
	"time"
)

const (
	DefaultAddr          = ":8080"
	DefaultRedisURL      = "redis://localhost:6379/0"
	DefaultMessageBytes  = 4096
	DefaultPingPeriodSec = 30
	DefaultPongWaitSec   = 60
	DefaultWriteWaitSec  = 10
)

// Config contains runtime settings for the websocket server.
type Config struct {
	Addr             string
	RedisURL         string
	JWTSecret        string
	MessageByteLimit int64
	MessageRatePerMin int
	PingPeriod       time.Duration
	PongWait         time.Duration
	WriteWait        time.Duration
}

// Load reads process environment and returns a validated config.
func Load() Config {
	return Config{
		Addr:             getEnv("CHAT_SERVER_ADDR", DefaultAddr),
		RedisURL:         getEnv("REDIS_URL", DefaultRedisURL),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		MessageByteLimit: int64(getEnvInt("CHAT_MESSAGE_LIMIT_BYTES", DefaultMessageBytes)),
		MessageRatePerMin: getEnvInt("CHAT_MESSAGE_RATE_PER_MINUTE", 60),
		PingPeriod:       time.Duration(getEnvInt("CHAT_PING_PERIOD_SECONDS", DefaultPingPeriodSec)) * time.Second,
		PongWait:         time.Duration(getEnvInt("CHAT_PONG_WAIT_SECONDS", DefaultPongWaitSec)) * time.Second,
		WriteWait:        time.Duration(getEnvInt("CHAT_WRITE_WAIT_SECONDS", DefaultWriteWaitSec)) * time.Second,
	}
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
