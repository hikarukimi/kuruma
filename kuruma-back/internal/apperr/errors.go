package apperr

import "errors"

var (
	ErrInvalidRegisterInput = errors.New("invalid register input")
	ErrAccountAlreadyExists = errors.New("account already exists")
	ErrUserNotFound         = errors.New("user not found")
)
