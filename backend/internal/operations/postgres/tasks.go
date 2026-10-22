package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	db "numdock/backend/internal/operations/postgres/db"
	"time"
)

// RunTask is idempotent: every state change and follow-up task shares one transaction.
func (s *Store) RunTask(ctx context.Context, kind, id string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	switch kind {
	case "expire_payment":
		org, e := q.ExpirePayment(ctx, id)
		if errors.Is(e, pgx.ErrNoRows) {
			return nil
		}
		if e != nil {
			return e
		}
		if err = s.emit(ctx, tx, q, org, "payment.updated", id); err != nil {
			return err
		}
	case "expire_lease":
		l, e := q.LeaseForIncoming(ctx, id)
		if errors.Is(e, pgx.ErrNoRows) {
			return nil
		}
		if e != nil {
			return e
		}
		if l.Status == "active" && !l.ExpiresAt.Time.After(time.Now()) {
			if _, e = q.FinishLease(ctx, db.FinishLeaseParams{ID: id, OrganizationID: l.OrganizationID, Status: "expired"}); e != nil {
				return e
			}
			if e = q.SetCatalogStatus(ctx, db.SetCatalogStatusParams{ID: l.CatalogItemID, Status: "quarantined"}); e != nil {
				return e
			}
			if e = s.queue(ctx, tx, "unquarantine", l.CatalogItemID, time.Now().Add(5*time.Minute)); e != nil {
				return e
			}
			if e = s.emit(ctx, tx, q, l.OrganizationID, "number.updated", id); e != nil {
				return e
			}
		}
	case "unquarantine":
		if err = q.ReactivateCatalog(ctx, id); err != nil {
			return err
		}
	case "purge_provider":
		if err = q.ForgetProviderEvent(ctx, id); err != nil {
			return err
		}
	case "purge_message":
		if err = q.ExpireMessage(ctx, id); err != nil {
			return err
		}
		if err = q.ForgetProviderEvent(ctx, id); err != nil {
			return err
		}
	case "deliver":
		// Obsolete outbound-webhook jobs are retired without network delivery.
		return nil
	default:
		return errors.New("unknown durable task")
	}
	return tx.Commit(ctx)
}
