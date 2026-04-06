package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Claims captures the subset of JWT fields used by chat auth.
type Claims struct {
	UserID string
	Name   string
}

// ValidateWSJWT validates JWT from Authorization header or token query string.
func ValidateWSJWT(r *http.Request, secret string) (Claims, error) {
	if secret == "" {
		return Claims{}, errors.New("JWT secret is not configured")
	}

	token := ""
	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
		token = strings.TrimSpace(authorization[7:])
	}
	if token == "" {
		token = strings.TrimSpace(r.URL.Query().Get("token"))
	}
	if token == "" {
		return Claims{}, errors.New("missing token")
	}

	parsed, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return []byte(secret), nil
	})
	if err != nil {
		return Claims{}, err
	}
	if !parsed.Valid {
		return Claims{}, errors.New("invalid token")
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return Claims{}, errors.New("invalid claims")
	}

	sub, ok := claims["sub"].(string)
	if !ok || strings.TrimSpace(sub) == "" {
		return Claims{}, errors.New("missing subject claim")
	}

	name := ""
	if value, exists := claims["name"]; exists {
		name, _ = value.(string)
	}
	if name == "" {
		name = sub
	}

	return Claims{UserID: sub, Name: name}, nil
}
