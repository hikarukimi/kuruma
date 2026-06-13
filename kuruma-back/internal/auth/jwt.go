package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"kuruma-back/internal/model"
)

type JWTClaims struct {
	Subject   string `json:"sub"`
	Account   string `json:"account"`
	Role      string `json:"role"`
	ExpiresAt int64  `json:"exp"`
	IssuedAt  int64  `json:"iat"`
}

const JWTClaimsContextKey = "jwtClaims"

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("expired token")
)

func GenerateToken(user *model.User, secret string, ttl time.Duration) (string, error) {
	if user == nil {
		return "", fmt.Errorf("user is nil")
	}
	if strings.TrimSpace(secret) == "" {
		return "", fmt.Errorf("jwt secret is empty")
	}
	if ttl <= 0 {
		return "", fmt.Errorf("jwt ttl must be positive")
	}

	now := time.Now()
	claims := JWTClaims{
		Subject:   fmt.Sprintf("%d", user.ID),
		Account:   user.Account,
		Role:      user.Role,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(ttl).Unix(),
	}

	header := map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	}

	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	encodedHeader := base64.RawURLEncoding.EncodeToString(headerJSON)
	encodedClaims := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signingInput := encodedHeader + "." + encodedClaims

	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(signingInput)); err != nil {
		return "", err
	}
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + signature, nil
}

func ParseToken(token string, secret string) (*JWTClaims, error) {
	token = strings.TrimSpace(token)
	if token == "" || strings.TrimSpace(secret) == "" {
		return nil, ErrInvalidToken
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}

	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, ErrInvalidToken
	}

	var header struct {
		Algorithm string `json:"alg"`
		Type      string `json:"typ"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return nil, ErrInvalidToken
	}
	if header.Algorithm != "HS256" || header.Type != "JWT" {
		return nil, ErrInvalidToken
	}

	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(signingInput)); err != nil {
		return nil, ErrInvalidToken
	}
	expectedSignature := mac.Sum(nil)

	actualSignature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, ErrInvalidToken
	}
	if !hmac.Equal(actualSignature, expectedSignature) {
		return nil, ErrInvalidToken
	}

	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrInvalidToken
	}

	var claims JWTClaims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return nil, ErrInvalidToken
	}
	if claims.Subject == "" || claims.ExpiresAt <= 0 {
		return nil, ErrInvalidToken
	}
	if time.Now().Unix() >= claims.ExpiresAt {
		return nil, ErrExpiredToken
	}

	return &claims, nil
}
