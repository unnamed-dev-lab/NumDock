package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"numdock/backend/internal/operations"
	db "numdock/backend/internal/operations/postgres/db"
	"time"
	"unicode/utf8"
)

func (s *Store) Ingest(ctx context.Context, in operations.Incoming) (string, error) {
	if !s.development {
		return "", operations.Fail("feature_disabled")
	}
	if len(in.ID) < 8 || len(in.ID) > 128 || len(in.LeaseID) > 128 || in.Body == "" || utf8.RuneCountInString(in.Body) > 1600 || in.OccurredAt.IsZero() || in.OccurredAt.After(time.Now().Add(time.Minute)) {
		return "", operations.Fail("validation_failed")
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	if err = q.LockOperation(ctx, "provider:"+in.ID); err != nil {
		return "", err
	}
	encoded, err := json.Marshal(in)
	if err != nil {
		return "", err
	}
	digest := hash(string(encoded))
	prior, err := q.ExistingProviderEvent(ctx, in.ID)
	if err == nil {
		if string(prior) != string(digest) {
			return "", operations.Fail("idempotency_conflict")
		}
		return "duplicate", tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	lease, err := q.LeaseForIncoming(ctx, in.LeaseID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	valid := err == nil && lease.Status == "active" && lease.ExpiresAt.Time.After(time.Now()) && !in.OccurredAt.Before(lease.StartedAt.Time) && in.OccurredAt.Before(lease.ExpiresAt.Time)
	state, aad := "quarantined", "provider:"+in.ID
	if valid {
		state, aad = "accepted", lease.OrganizationID+":"+in.ID
		item, e := q.LockCatalogItem(ctx, lease.CatalogItemID)
		if e != nil {
			return "", e
		}
		if !contains(item.Capabilities, "sms") {
			valid = false
			state, aad = "quarantined", "provider:"+in.ID
		}
	}
	cipher, err := s.seal([]byte(in.Body), aad)
	if err != nil {
		return "", err
	}
	raw := encoded
	if len(in.Raw) > 0 {
		raw = in.Raw
	}
	rawCipher, e := s.seal(raw, "provider:"+in.ID)
	if e != nil {
		return "", e
	}
	if err = q.SaveProviderEvent(ctx, db.SaveProviderEventParams{ID: in.ID, LeaseID: in.LeaseID, PayloadHash: digest, PayloadCiphertext: rawCipher, State: state}); err != nil {
		return "", err
	}
	expiry := time.Now().Add(30 * 24 * time.Hour)
	if err = s.queue(ctx, tx, "purge_provider", in.ID, expiry); err != nil {
		return "", err
	}
	if valid {
		m, err := q.CreateMessage(ctx, db.CreateMessageParams{ID: in.ID, OrganizationID: lease.OrganizationID, LeaseID: lease.ID, ProviderEventID: in.ID, PayloadCiphertext: cipher, ExpiresAt: date(expiry)})
		if err != nil {
			return "", err
		}
		if err = s.queue(ctx, tx, "purge_message", m.ID, expiry); err != nil {
			return "", err
		}
		if err = s.emit(ctx, tx, q, lease.OrganizationID, "message.received", m.ID); err != nil {
			return "", err
		}
	}
	return state, tx.Commit(ctx)
}
