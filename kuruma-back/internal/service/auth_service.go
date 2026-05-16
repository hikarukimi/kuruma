package service

import (
	"context"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"kuruma-back/internal/apperr"
	"kuruma-back/internal/model"
)

const DefaultUserRole = "user"

var (
	ErrInvalidRegisterInput = apperr.ErrInvalidRegisterInput
	ErrAccountAlreadyExists = apperr.ErrAccountAlreadyExists
	ErrUserNotFound         = apperr.ErrUserNotFound
)

type UserStore interface {
	Create(ctx context.Context, user *model.User) error
	FindByAccount(ctx context.Context, account string) (*model.User, error)
}

type AuthService struct {
	users UserStore
}

type RegisterInput struct {
	Account     string
	Phone       string
	Password    string
	DisplayName string
}

func NewAuthService(users UserStore) *AuthService {
	return &AuthService{users: users}
}

func (s *AuthService) Register(ctx context.Context, input RegisterInput) (*model.User, error) {
	account := strings.TrimSpace(input.Account)
	phone := strings.TrimSpace(input.Phone)
	displayName := strings.TrimSpace(input.DisplayName)

	if account == "" || len(account) > 64 || len(phone) > 20 || displayName == "" || len(displayName) > 64 || len(input.Password) < 8 {
		return nil, ErrInvalidRegisterInput
	}

	if _, err := s.users.FindByAccount(ctx, account); err == nil {
		return nil, ErrAccountAlreadyExists
	} else if !errors.Is(err, ErrUserNotFound) {
		return nil, err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var phoneValue *string
	if phone != "" {
		phoneValue = &phone
	}

	user := &model.User{
		Account:     account,
		Phone:       phoneValue,
		Password:    string(hashedPassword),
		Role:        DefaultUserRole,
		DisplayName: displayName,
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}
