package identity

import (
	"context"
	"errors"
	"time"
)

const SessionTTL = 12 * time.Hour

var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrPasswordLength     = errors.New("password length must be between 12 and 128 characters")
)

type User struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string
	CreatedAt    time.Time
}

type Organization struct {
	ID        string
	Name      string
	Role      string
	CreatedAt time.Time
}

type Identity struct {
	User          User
	Organizations []Organization
}

// StoreError wraps persistence failures with a safe operation name and
// PostgreSQL SQLSTATE (when available). It never contains query arguments or
// row data, so it is safe to log.
type StoreError struct {
	Operation string
	Code      string
	Err       error
}

func (e *StoreError) Error() string {
	if e.Operation == "" {
		return "identity store operation failed"
	}
	return "identity store " + e.Operation + " failed"
}

func (e *StoreError) Unwrap() error {
	return e.Err
}

type CreateAccountParams struct {
	Email            string
	Name             string
	PasswordHash     string
	OrganizationName string
	SessionTokenHash []byte
	SessionExpiresAt time.Time
}

type SessionParams struct {
	TokenHash []byte
	UserID    string
	ExpiresAt time.Time
}

type ListOrganizationsParams struct {
	UserID string
	Limit  int32
	Offset int32
}

// Store is the identity persistence port. PostgreSQL is the only adapter today,
// but the service only depends on this interface.
type Store interface {
	CreateAccount(ctx context.Context, params CreateAccountParams) (User, []Organization, error)
	UserByEmail(ctx context.Context, email string) (User, error)
	RotateSession(ctx context.Context, oldTokenHash []byte, params SessionParams) ([]Organization, error)
	SessionUser(ctx context.Context, tokenHash []byte) (User, error)
	UserOrganizations(ctx context.Context, userID string) ([]Organization, error)
	ListUserOrganizations(ctx context.Context, params ListOrganizationsParams) ([]Organization, error)
	DeleteSession(ctx context.Context, tokenHash []byte) error
	ConsumeAuthLimit(ctx context.Context, key string) (int32, error)
}
