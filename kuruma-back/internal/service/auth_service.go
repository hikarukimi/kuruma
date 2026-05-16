package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"kuruma-back/internal/apperr"
	"kuruma-back/internal/auth"
	"kuruma-back/internal/model"
)

const DefaultUserRole = "user"

var (
	ErrInvalidRegisterInput = apperr.ErrInvalidRegisterInput
	ErrAccountAlreadyExists = apperr.ErrAccountAlreadyExists
	ErrInvalidLoginInput    = apperr.ErrInvalidLoginInput
	ErrInvalidCredentials   = apperr.ErrInvalidCredentials
	ErrUserNotFound         = apperr.ErrUserNotFound
)

type UserStore interface {
	Create(ctx context.Context, user *model.User) error
	FindByAccount(ctx context.Context, account string) (*model.User, error)
	FindByPhone(ctx context.Context, phone string) (*model.User, error)
}

type AuthService struct {
	users     UserStore
	jwtSecret string
	jwtTTL    time.Duration
}

type RegisterInput struct {
	Account     string
	Phone       string
	Password    string
	DisplayName string
}

type LoginInput struct {
	Account  string
	Phone    string
	Password string
}

type LoginResult struct {
	User  *model.User
	Token string
}

func NewAuthService(users UserStore, jwtSecret string, jwtExpiresHours int) *AuthService {
	if jwtExpiresHours <= 0 {
		jwtExpiresHours = 24
	}

	return &AuthService{
		users:     users,
		jwtSecret: jwtSecret,
		jwtTTL:    time.Duration(jwtExpiresHours) * time.Hour,
	}
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

func (s *AuthService) Login(ctx context.Context, input LoginInput) (*LoginResult, error) {
	account := strings.TrimSpace(input.Account)
	phone := strings.TrimSpace(input.Phone)

	if input.Password == "" || (account == "" && phone == "") {
		return nil, ErrInvalidLoginInput
	}

	var (
		user *model.User
		err  error
	)
	if phone != "" {
		user, err = s.users.FindByPhone(ctx, phone)
	} else {
		user, err = s.users.FindByAccount(ctx, account)
	}
	if errors.Is(err, ErrUserNotFound) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := auth.GenerateToken(user, s.jwtSecret, s.jwtTTL)
	if err != nil {
		return nil, err
	}

	return &LoginResult{
		User:  user,
		Token: token,
	}, nil
}
