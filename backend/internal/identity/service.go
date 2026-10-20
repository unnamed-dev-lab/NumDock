package identity

import (
	"context"
	"crypto/sha256"
	"errors"
	"time"
)

type Service struct {
	store     Store
	dummyHash string
}

type RegisterInput struct {
	Email            string
	Password         string
	Name             string
	OrganizationName string
}

func NewService(store Store) (*Service, error) {
	dummy, err := hashPassword("constant-dummy-password-not-a-user")
	if err != nil {
		return nil, err
	}
	return &Service{store: store, dummyHash: dummy}, nil
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (Identity, string, error) {
	if err := ValidatePassword(input.Password); err != nil {
		return Identity{}, "", err
	}
	passwordHash, err := hashPassword(input.Password)
	if err != nil {
		return Identity{}, "", err
	}
	token, err := randomToken()
	if err != nil {
		return Identity{}, "", err
	}
	user, organizations, err := s.store.CreateAccount(ctx, CreateAccountParams{
		Email:            input.Email,
		Name:             input.Name,
		PasswordHash:     passwordHash,
		OrganizationName: input.OrganizationName,
		SessionTokenHash: hashToken(token),
		SessionExpiresAt: time.Now().Add(SessionTTL),
	})
	if err != nil {
		return Identity{}, "", err
	}
	user.PasswordHash = ""
	return Identity{User: user, Organizations: organizations}, token, nil
}

func (s *Service) Login(ctx context.Context, email, password, oldSessionToken string) (Identity, string, error) {
	user, err := s.store.UserByEmail(ctx, email)
	if errors.Is(err, ErrUserNotFound) {
		// Keep the expensive password check to reduce account-enumeration timing
		// differences between existing and missing accounts.
		verifyPassword(password, s.dummyHash)
		return Identity{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return Identity{}, "", err
	}
	if !verifyPassword(password, user.PasswordHash) {
		return Identity{}, "", ErrInvalidCredentials
	}
	user.PasswordHash = ""
	token, err := randomToken()
	if err != nil {
		return Identity{}, "", err
	}
	var oldTokenHash []byte
	if oldSessionToken != "" {
		oldTokenHash = hashToken(oldSessionToken)
	}
	organizations, err := s.store.RotateSession(ctx, oldTokenHash, SessionParams{
		TokenHash: hashToken(token),
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(SessionTTL),
	})
	if err != nil {
		return Identity{}, "", err
	}
	return Identity{User: user, Organizations: organizations}, token, nil
}

func (s *Service) CurrentUser(ctx context.Context, sessionToken string) (User, error) {
	if sessionToken == "" {
		return User{}, ErrUnauthenticated
	}
	user, err := s.store.SessionUser(ctx, hashToken(sessionToken))
	if err != nil {
		return User{}, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *Service) Identity(ctx context.Context, user User) (Identity, error) {
	organizations, err := s.store.UserOrganizations(ctx, user.ID)
	if err != nil {
		return Identity{}, err
	}
	return Identity{User: user, Organizations: organizations}, nil
}

func (s *Service) Organizations(ctx context.Context, userID string, limit, offset int32) ([]Organization, error) {
	return s.store.ListUserOrganizations(ctx, ListOrganizationsParams{UserID: userID, Limit: limit, Offset: offset})
}

func (s *Service) Logout(ctx context.Context, sessionToken string) error {
	if sessionToken == "" {
		return ErrUnauthenticated
	}
	return s.store.DeleteSession(ctx, hashToken(sessionToken))
}

func (s *Service) ConsumeAuthLimit(ctx context.Context, key string) (int32, error) {
	return s.store.ConsumeAuthLimit(ctx, key)
}

func hashToken(token string) []byte {
	hash := sha256.Sum256([]byte(token))
	return hash[:]
}
