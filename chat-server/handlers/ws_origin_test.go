package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsOriginAllowed_RejectsBrowserOriginWhenAllowlistMissing(t *testing.T) {
	h := &WSHandler{allowedOrigin: map[string]struct{}{}}
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Origin", "https://evil.example")

	if h.isOriginAllowed(req) {
		t.Fatal("expected origin rejection when no allowlist is configured")
	}
}

func TestIsOriginAllowed_AllowsConfiguredOrigin(t *testing.T) {
	h := &WSHandler{allowedOrigin: map[string]struct{}{"https://app.example": {}}}
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Origin", "https://app.example")

	if !h.isOriginAllowed(req) {
		t.Fatal("expected configured origin to be allowed")
	}
}

func TestIsOriginAllowed_AllowsMissingOriginForNonBrowserClients(t *testing.T) {
	h := &WSHandler{allowedOrigin: map[string]struct{}{}}
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)

	if !h.isOriginAllowed(req) {
		t.Fatal("expected requests without origin to be allowed")
	}
}
