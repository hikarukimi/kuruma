package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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
