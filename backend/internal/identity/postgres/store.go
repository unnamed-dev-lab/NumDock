package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"numdock/backend/internal/identity"
	identitydb "numdock/backend/internal/identity/postgres/db"
)

var _ identity.Store = (*Store)(nil)

type Store struct {
	pool    *pgxpool.Pool
	queries *identitydb.Queries
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool, queries: identitydb.New(pool)}
}

func (s *Store) CreateAccount(ctx context.Context, params identity.CreateAccountParams) (user identity.User, organizations []identity.Organization, err error) {
	defer func() { err = wrapError("create_account", err) }()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return identity.User{}, nil, err
	}
	defer tx.Rollback(ctx)
	q := s.queries.WithTx(tx)

	createdUser, err := q.CreateUser(ctx, identitydb.CreateUserParams{
		Email:        params.Email,
		Name:         params.Name,
		PasswordHash: params.PasswordHash,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return identity.User{}, nil, identity.ErrEmailTaken
		}
		return identity.User{}, nil, err
	}
	slug, err := identity.OrganizationSlug(params.OrganizationName)
	if err != nil {
		return identity.User{}, nil, err
	}
	organization, err := q.CreateOrganization(ctx, identitydb.CreateOrganizationParams{Name: params.OrganizationName, Slug: slug})
	if err != nil {
		return identity.User{}, nil, err
	}
	if err := q.CreateMembership(ctx, identitydb.CreateMembershipParams{
		UserID:         createdUser.ID,
		OrganizationID: organization.ID,
	}); err != nil {
		return identity.User{}, nil, err
	}
	if err := q.CreateSession(ctx, identitydb.CreateSessionParams{
		TokenHash: params.SessionTokenHash,
		UserID:    createdUser.ID,
		ExpiresAt: timestamp(params.SessionExpiresAt),
	}); err != nil {
		return identity.User{}, nil, err
	}
	rows, err := q.UserOrganizations(ctx, createdUser.ID)
	if err != nil {
		return identity.User{}, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return identity.User{}, nil, err
	}
	return mapUser(createdUser), mapUserOrganizations(rows), nil
}

func (s *Store) UserByEmail(ctx context.Context, email string) (user identity.User, err error) {
	defer func() { err = wrapError("user_by_email", err) }()

	dbUser, err := s.queries.UserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return identity.User{}, identity.ErrUserNotFound
	}
	if err != nil {
		return identity.User{}, err
	}
	return mapUser(dbUser), nil
}

func (s *Store) RotateSession(ctx context.Context, oldTokenHash []byte, params identity.SessionParams) (organizations []identity.Organization, err error) {
	defer func() { err = wrapError("rotate_session", err) }()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	q := s.queries.WithTx(tx)

	if len(oldTokenHash) > 0 {
		if err := q.DeleteSession(ctx, oldTokenHash); err != nil {
			return nil, err
		}
	}
	if err := q.CreateSession(ctx, identitydb.CreateSessionParams{
		TokenHash: params.TokenHash,
		UserID:    params.UserID,
		ExpiresAt: timestamp(params.ExpiresAt),
	}); err != nil {
		return nil, err
	}
	rows, err := q.UserOrganizations(ctx, params.UserID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return mapUserOrganizations(rows), nil
}

func (s *Store) SessionUser(ctx context.Context, tokenHash []byte) (user identity.User, err error) {
	defer func() { err = wrapError("session_user", err) }()

	dbUser, err := s.queries.SessionUser(ctx, tokenHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return identity.User{}, identity.ErrUnauthenticated
	}
	if err != nil {
		return identity.User{}, err
	}
	return mapUser(dbUser), nil
}

func (s *Store) UserOrganizations(ctx context.Context, userID string) (organizations []identity.Organization, err error) {
	defer func() { err = wrapError("user_organizations", err) }()

	rows, err := s.queries.UserOrganizations(ctx, userID)
	if err != nil {
		return nil, err
	}
	return mapUserOrganizations(rows), nil
}

func (s *Store) ListUserOrganizations(ctx context.Context, params identity.ListOrganizationsParams) (organizations []identity.Organization, err error) {
	defer func() { err = wrapError("list_user_organizations", err) }()

	rows, err := s.queries.ListUserOrganizations(ctx, identitydb.ListUserOrganizationsParams{
		UserID: params.UserID,
		Limit:  params.Limit,
		Offset: params.Offset,
	})
	if err != nil {
		return nil, err
	}
	organizations = make([]identity.Organization, 0, len(rows))
	for _, row := range rows {
		organizations = append(organizations, identity.Organization{
			ID:        row.ID,
			Name:      row.Name,
			Slug:      row.Slug,
			Role:      row.Role,
			CreatedAt: row.CreatedAt.Time,
		})
	}
	return organizations, nil
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) (err error) {
	defer func() { err = wrapError("delete_session", err) }()
	return s.queries.DeleteSession(ctx, tokenHash)
}

func (s *Store) ConsumeAuthLimit(ctx context.Context, key string) (count int32, err error) {
	defer func() { err = wrapError("consume_auth_limit", err) }()
	return s.queries.ConsumeAuthLimit(ctx, key)
}

func (s *Store) PruneAuthLimits(ctx context.Context) (err error) {
	defer func() { err = wrapError("prune_auth_limits", err) }()
	return s.queries.PruneAuthLimits(ctx)
}

func (s *Store) PruneSessions(ctx context.Context) (err error) {
	defer func() { err = wrapError("prune_sessions", err) }()
	return s.queries.PruneSessions(ctx)
}

func mapUser(user identitydb.User) identity.User {
	return identity.User{
		ID:           user.ID,
		Email:        user.Email,
		Name:         user.Name,
		PasswordHash: user.PasswordHash,
		CreatedAt:    user.CreatedAt.Time,
	}
}

func mapUserOrganizations(rows []identitydb.UserOrganizationsRow) []identity.Organization {
	organizations := make([]identity.Organization, 0, len(rows))
	for _, row := range rows {
		organizations = append(organizations, identity.Organization{
			ID:        row.ID,
			Name:      row.Name,
			Slug:      row.Slug,
			Role:      row.Role,
			CreatedAt: row.CreatedAt.Time,
		})
	}
	return organizations
}

func timestamp(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func wrapError(operation string, err error) error {
	if err == nil {
		return nil
	}
	var storeErr *identity.StoreError
	if errors.As(err, &storeErr) {
		return err
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return &identity.StoreError{Operation: operation, Code: pgErr.Code, Err: err}
	}
	return &identity.StoreError{Operation: operation, Err: err}
}
