package middleware

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func buildToken(t *testing.T, secret string, expiresAt time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":  "user-1",
		"name": "User One",
		"iat":  time.Now().UTC().Unix(),
		"exp":  expiresAt.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}

func TestValidateWSJWT_RejectsExpiredToken(t *testing.T) {
	secret := "test-secret"
	token := buildToken(t, secret, time.Now().UTC().Add(-1*time.Minute))

	req := &http.Request{Header: make(http.Header), URL: &url.URL{}}
	req.Header.Set("Authorization", "Bearer "+token)

	_, err := ValidateWSJWT(req, secret)
	if err == nil {
		t.Fatal("expected expired token error")
	}
}

func TestValidateWSJWT_AcceptsValidToken(t *testing.T) {
	secret := "test-secret"
	token := buildToken(t, secret, time.Now().UTC().Add(10*time.Minute))

	req := &http.Request{Header: make(http.Header), URL: &url.URL{}}
	req.Header.Set("Authorization", "Bearer "+token)

	claims, err := ValidateWSJWT(req, secret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claims.UserID != "user-1" {
		t.Fatalf("unexpected user id: %s", claims.UserID)
	}
}
