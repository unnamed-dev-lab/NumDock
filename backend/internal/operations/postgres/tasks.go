package postgres

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"io"
	"net/http"
	db "numdock/backend/internal/operations/postgres/db"
	"numdock/backend/internal/platform/safehttp"
	"strconv"
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
		return s.deliver(ctx, tx, q, id)
	default:
		return errors.New("unknown durable task")
	}
	return tx.Commit(ctx)
}
func (s *Store) deliver(ctx context.Context, tx pgx.Tx, q *db.Queries, id string) error {
	d, err := q.DeliveryForWork(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if d.NextAttemptAt.Valid && d.NextAttemptAt.Time.After(time.Now()) {
		return nil
	}
	if d.Status != "pending" {
		return nil
	}
	state, code := "disabled", int32(0)
	if d.Enabled {
		secret, err := s.open(d.SecretCiphertext, d.OrganizationID+":"+d.EndpointID)
		if err != nil {
			return err
		}
		payload, err := json.Marshal(struct {
			ID         int64  `json:"id"`
			Type       string `json:"type"`
			ResourceID string `json:"resource_id"`
			Source     string `json:"source"`
		}{d.EventID, d.Type, d.ResourceID, "mock"})
		if err != nil {
			return err
		}
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		mac := hmac.New(sha256.New, secret)
		mac.Write([]byte(timestamp + "."))
		mac.Write(payload)
		switch d.Url {
		case "mock://success":
			code = 200
		case "mock://failure":
			code = 503
		default:
			if err = safehttp.Validate(d.Url); err == nil {
				request, e := http.NewRequestWithContext(ctx, http.MethodPost, d.Url, bytes.NewReader(payload))
				if e == nil {
					request.Header.Set("Content-Type", "application/json")
					request.Header.Set("X-NumDock-Signature", "t="+timestamp+",v1="+hex.EncodeToString(mac.Sum(nil)))
					request.Header.Set("X-NumDock-Event-ID", strconv.FormatInt(d.EventID, 10))
					client := safehttp.Client()
					defer client.CloseIdleConnections()
					response, e := client.Do(request)
					if e == nil {
						code = int32(response.StatusCode)
						_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
						response.Body.Close()
					}
				}
			}
		}
		state = "succeeded"
		if code < 200 || code >= 300 {
			state = "pending"
			if d.Attempts >= 4 {
				state = "failed"
			}
		}
	}
	next := time.Time{}
	if state == "pending" {
		next = time.Now().Add(time.Duration(1<<uint(d.Attempts)) * 5 * time.Second)
		if err = s.queue(ctx, tx, "deliver", id, next); err != nil {
			return err
		}
	}
	if err = q.RecordDelivery(ctx, db.RecordDeliveryParams{ID: id, Status: state, ResponseStatus: code, NextAttemptAt: dateOrNull(next)}); err != nil {
		return err
	}
	if _, err = q.EmitEvent(ctx, db.EmitEventParams{OrganizationID: d.OrganizationID, Type: "webhook.delivery", ResourceID: id}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func dateOrNull(t time.Time) pgtype.Timestamptz {
	if t.IsZero() {
		return pgtype.Timestamptz{}
	}
	return date(t)
}
