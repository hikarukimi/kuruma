package apperr

import "errors"

var (
	ErrInvalidRegisterInput = errors.New("invalid register input")
	ErrAccountAlreadyExists = errors.New("account already exists")
	ErrInvalidLoginInput    = errors.New("invalid login input")
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrUserNotFound         = errors.New("user not found")
)
