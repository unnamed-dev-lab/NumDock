package postgres

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"numdock/backend/internal/operations"
	db "numdock/backend/internal/operations/postgres/db"
	"numdock/backend/internal/providers"
	"time"
)

type Enqueue func(context.Context, pgx.Tx, string, string, time.Time) error
type Store struct {
	Pool        *pgxpool.Pool
	cipher      cipher.AEAD
	enqueue     Enqueue
	development bool
	provider    providers.Mock
}

func New(pool *pgxpool.Pool, key []byte, development bool) (*Store, error) {
	s := &Store{Pool: pool, development: development}
	if development {
		if len(key) != 32 {
			return nil, errors.New("DATA_ENCRYPTION_KEY must contain 32 bytes")
		}
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, errors.New("DATA_ENCRYPTION_KEY must contain 32 bytes")
		}
		s.cipher, err = cipher.NewGCM(block)
		if err != nil {
			return nil, err
		}
	}
	return s, nil
}
func (s *Store) SetEnqueuer(enqueue Enqueue) { s.enqueue = enqueue }
func (s *Store) seal(value []byte, aad string) ([]byte, error) {
	nonce := make([]byte, s.cipher.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return s.cipher.Seal(nonce, nonce, value, []byte(aad)), nil
}
func (s *Store) open(value []byte, aad string) ([]byte, error) {
	n := s.cipher.NonceSize()
	if len(value) < n {
		return nil, errors.New("invalid encrypted payload")
	}
	return s.cipher.Open(nil, value[:n], value[n:], []byte(aad))
}
func hash(value string) []byte                { v := sha256.Sum256([]byte(value)); return v[:] }
func date(value time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: value, Valid: true} }
func role(ctx context.Context, q *db.Queries, a operations.Actor, write bool) (string, error) {
	v, err := q.MembershipRole(ctx, db.MembershipRoleParams{OrganizationID: a.OrganizationID, UserID: a.UserID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", operations.Fail("not_found")
	}
	if err != nil {
		return "", err
	}
	if write && v != "owner" && v != "admin" {
		return "", operations.Fail("forbidden")
	}
	return v, nil
}
func wallet(row db.Wallet) operations.Wallet {
	return operations.Wallet{Currency: row.Currency, AvailableMinor: row.AvailableMinor, ReservedMinor: row.ReservedMinor}
}
func (s *Store) queue(ctx context.Context, tx pgx.Tx, kind, id string, when time.Time) error {
	if s.enqueue == nil {
		return errors.New("persistent queue is not configured")
	}
	return s.enqueue(ctx, tx, kind, id, when)
}
func (s *Store) emit(ctx context.Context, tx pgx.Tx, q *db.Queries, org, kind, id string) error {
	_, err := q.EmitEvent(ctx, db.EmitEventParams{OrganizationID: org, Type: kind, ResourceID: id})
	if err != nil {
		return err
	}
	return nil
}
func (s *Store) ledger(ctx context.Context, q *db.Queries, org, reference, kind string, available, reserved int64) (operations.Wallet, error) {
	row, err := q.UpdateWallet(ctx, db.UpdateWalletParams{OrganizationID: org, AvailableDelta: available, ReservedDelta: reserved})
	if err != nil {
		return operations.Wallet{}, err
	}
	err = q.RecordLedger(ctx, db.RecordLedgerParams{OrganizationID: org, ReferenceID: reference, Kind: kind, AvailableDelta: available, ReservedDelta: reserved, AvailableAfter: row.AvailableMinor, ReservedAfter: row.ReservedMinor})
	return wallet(row), err
}
func (s *Store) Execute(ctx context.Context, a operations.Actor, key string, c operations.Command) (operations.Result, error) {
	if !s.development {
		return operations.Result{}, operations.Fail("feature_disabled")
	}
	attempts, err := db.New(s.Pool).ConsumeOperationLimit(ctx, "write:"+a.OrganizationID+":"+a.UserID)
	if err != nil {
		return operations.Result{}, err
	}
	if attempts > 120 {
		return operations.Result{}, operations.Fail("rate_limited")
	}
	if len(key) < 8 || len(key) > 128 {
		return operations.Result{}, operations.Fail("validation_failed")
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return operations.Result{}, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	if _, err = role(ctx, q, a, true); err != nil {
		return operations.Result{}, err
	}
	if err = q.LockOperation(ctx, a.OrganizationID+":"+c.Kind+":"+key); err != nil {
		return operations.Result{}, err
	}
	input, err := json.Marshal(struct {
		Kind, Resource string
		Input          operations.Command
	}{c.Kind, c.ResourceID, c})
	if err != nil {
		return operations.Result{}, err
	}
	digest := hash(string(input))
	prior, err := q.OperationResult(ctx, db.OperationResultParams{OrganizationID: a.OrganizationID, Operation: c.Kind, Key: key})
	if err == nil {
		if string(prior.RequestHash) != string(digest) {
			return operations.Result{}, operations.Fail("idempotency_conflict")
		}
		var result operations.Result
		if err = json.Unmarshal(prior.Response, &result); err != nil {
			return result, err
		}
		return result, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return operations.Result{}, err
	}
	if err = q.EnsureWallet(ctx, a.OrganizationID); err != nil {
		return operations.Result{}, err
	}
	result, err := s.execute(ctx, tx, q, a, c)
	if err != nil {
		return operations.Result{}, err
	}
	if err = q.AuditOperation(ctx, db.AuditOperationParams{OrganizationID: a.OrganizationID, UserID: pgtype.Text{String: a.UserID, Valid: true}, Action: c.Kind, ResourceID: result.ID}); err != nil {
		return operations.Result{}, err
	}
	stored := result
	encoded, err := json.Marshal(stored)
	if err != nil {
		return operations.Result{}, err
	}
	if err = q.SaveOperation(ctx, db.SaveOperationParams{OrganizationID: a.OrganizationID, Operation: c.Kind, Key: key, RequestHash: digest, Response: encoded}); err != nil {
		return operations.Result{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return operations.Result{}, err
	}
	return result, nil
}

func text(v string) pgtype.Text { return pgtype.Text{String: v, Valid: v != ""} }
