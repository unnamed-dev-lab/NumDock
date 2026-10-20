package identity

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"
)

type fakeStore struct {
	createParams CreateAccountParams
	createUser   User
	createOrgs   []Organization
	createErr    error

	user    User
	userErr error

	oldTokenHash []byte
	session      SessionParams
	sessionOrgs  []Organization
	sessionErr   error

	sessionUser    User
	sessionUserErr error

	userOrgs     []Organization
	userOrgsErr  error
	listParams   ListOrganizationsParams
	listOrgs     []Organization
	listErr      error
	deletedToken []byte
	deletedErr   error

	limitKey   string
	limitCount int32
	limitErr   error
}

func (f *fakeStore) CreateAccount(ctx context.Context, params CreateAccountParams) (User, []Organization, error) {
	f.createParams = params
	return f.createUser, f.createOrgs, f.createErr
}

func (f *fakeStore) UserByEmail(ctx context.Context, email string) (User, error) {
	return f.user, f.userErr
}

func (f *fakeStore) RotateSession(ctx context.Context, oldTokenHash []byte, params SessionParams) ([]Organization, error) {
	f.oldTokenHash = append([]byte(nil), oldTokenHash...)
	f.session = params
	return f.sessionOrgs, f.sessionErr
}

func (f *fakeStore) SessionUser(ctx context.Context, tokenHash []byte) (User, error) {
	return f.sessionUser, f.sessionUserErr
}

func (f *fakeStore) UserOrganizations(ctx context.Context, userID string) ([]Organization, error) {
	return f.userOrgs, f.userOrgsErr
}

func (f *fakeStore) ListUserOrganizations(ctx context.Context, params ListOrganizationsParams) ([]Organization, error) {
	f.listParams = params
	return f.listOrgs, f.listErr
}

func (f *fakeStore) DeleteSession(ctx context.Context, tokenHash []byte) error {
	f.deletedToken = append([]byte(nil), tokenHash...)
	return f.deletedErr
}

func (f *fakeStore) ConsumeAuthLimit(ctx context.Context, key string) (int32, error) {
	f.limitKey = key
	return f.limitCount, f.limitErr
}

func newTestService(t *testing.T) (*Service, *fakeStore) {
	t.Helper()
	store := &fakeStore{}
	service, err := NewService(store)
	if err != nil {
		t.Fatal(err)
	}
	return service, store
}

func TestServiceRegisterHashesPasswordAndToken(t *testing.T) {
	service, store := newTestService(t)
	store.createUser = User{ID: "user-1", Email: "alex@example.com"}
	store.createOrgs = []Organization{{ID: "org-1", Name: "Alpha", Role: "owner"}}

	result, token, err := service.Register(context.Background(), RegisterInput{
		Email:            "alex@example.com",
		Password:         "a sufficiently long passphrase",
		Name:             "Alex",
		OrganizationName: "Alpha",
	})
	if err != nil {
		t.Fatal(err)
	}
	if token == "" || result.User.ID != "user-1" || len(result.Organizations) != 1 {
		t.Fatalf("unexpected result: %+v token=%q", result, token)
	}
	if result.User.PasswordHash != "" {
		t.Fatal("password hash leaked out of the service")
	}
	if store.createParams.PasswordHash == "a sufficiently long passphrase" {
		t.Fatal("plain password reached the store")
	}
	if !verifyPassword("a sufficiently long passphrase", store.createParams.PasswordHash) {
		t.Fatal("stored password hash does not verify")
	}
	if !bytes.Equal(store.createParams.SessionTokenHash, hashToken(token)) {
		t.Fatal("session token hash does not match returned token")
	}
	if !store.createParams.SessionExpiresAt.After(time.Now()) {
		t.Fatal("session expiry is not in the future")
	}
}

func TestServiceRegisterRejectsShortPassword(t *testing.T) {
	service, store := newTestService(t)
	if _, _, err := service.Register(context.Background(), RegisterInput{Password: "short"}); !errors.Is(err, ErrPasswordLength) {
		t.Fatalf("error = %v, want ErrPasswordLength", err)
	}
	if store.createParams.Email != "" {
		t.Fatal("store was called for an invalid password")
	}
}

func TestServiceLogin(t *testing.T) {
	service, store := newTestService(t)
	hash, err := hashPassword("a sufficiently long passphrase")
	if err != nil {
		t.Fatal(err)
	}
	store.user = User{ID: "user-1", Email: "alex@example.com", PasswordHash: hash}
	store.sessionOrgs = []Organization{{ID: "org-1", Role: "owner"}}

	result, token, err := service.Login(context.Background(), "alex@example.com", "a sufficiently long passphrase", "old-token")
	if err != nil {
		t.Fatal(err)
	}
	if result.User.ID != "user-1" || len(result.Organizations) != 1 || token == "" {
		t.Fatalf("unexpected result: %+v token=%q", result, token)
	}
	if result.User.PasswordHash != "" {
		t.Fatal("password hash leaked out of the service")
	}
	if !bytes.Equal(store.oldTokenHash, hashToken("old-token")) {
		t.Fatal("old session token was not rotated")
	}
	if !bytes.Equal(store.session.TokenHash, hashToken(token)) {
		t.Fatal("new session token hash does not match returned token")
	}
}

func TestServiceLoginRejectsInvalidCredentials(t *testing.T) {
	service, store := newTestService(t)
	store.userErr = ErrUserNotFound
	if _, _, err := service.Login(context.Background(), "missing@example.com", "a sufficiently long passphrase", ""); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("missing user error = %v", err)
	}

	hash, err := hashPassword("a sufficiently long passphrase")
	if err != nil {
		t.Fatal(err)
	}
	store.userErr = nil
	store.user = User{ID: "user-1", PasswordHash: hash}
	if _, _, err := service.Login(context.Background(), "alex@example.com", "an incorrect long password", ""); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("wrong password error = %v", err)
	}
}

func TestServiceCurrentUserAndLogoutHashTokens(t *testing.T) {
	service, store := newTestService(t)
	store.sessionUser = User{ID: "user-1"}

	user, err := service.CurrentUser(context.Background(), "session-token")
	if err != nil {
		t.Fatal(err)
	}
	if user.ID != "user-1" {
		t.Fatalf("user = %+v", user)
	}
	if user.PasswordHash != "" {
		t.Fatal("password hash leaked out of the service")
	}
	if err := service.Logout(context.Background(), "session-token"); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(store.deletedToken, hashToken("session-token")) {
		t.Fatal("logout did not hash the session token")
	}
	if _, err := service.CurrentUser(context.Background(), ""); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("empty token error = %v", err)
	}
}

func TestServiceOrganizationsPassThrough(t *testing.T) {
	service, store := newTestService(t)
	store.listOrgs = []Organization{{ID: "org-1"}}
	items, err := service.Organizations(context.Background(), "user-1", 20, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || store.listParams.UserID != "user-1" || store.listParams.Limit != 20 || store.listParams.Offset != 5 {
		t.Fatalf("unexpected list params/result: %+v %+v", store.listParams, items)
	}
}
