package hub

import (
	"testing"
	"time"
)

func TestAllowMessageSend_EnforcesPerMinuteLimit(t *testing.T) {
	client := &Client{MessageRatePerMin: 2, rateWindow: make([]time.Time, 0, 4)}
	now := time.Now().UTC()

	if !client.AllowMessageSend(now) {
		t.Fatal("first message should pass")
	}
	if !client.AllowMessageSend(now.Add(10 * time.Second)) {
		t.Fatal("second message should pass")
	}
	if client.AllowMessageSend(now.Add(20 * time.Second)) {
		t.Fatal("third message in same minute should be rejected")
	}
	if !client.AllowMessageSend(now.Add(61 * time.Second)) {
		t.Fatal("message should pass after window expires")
	}
}
