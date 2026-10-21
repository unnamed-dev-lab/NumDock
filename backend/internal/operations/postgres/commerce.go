package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"numdock/backend/internal/operations"
	db "numdock/backend/internal/operations/postgres/db"
	"strings"
	"time"
	"unicode/utf8"
)

func (s *Store) execute(ctx context.Context, tx pgx.Tx, q *db.Queries, a operations.Actor, c operations.Command) (operations.Result, error) {
	switch c.Kind {
	case "credit":
		if c.AmountMinor < 100 || c.AmountMinor > 1000000 {
			return operations.Result{}, operations.Fail("validation_failed")
		}
		if _, err := q.LockWallet(ctx, a.OrganizationID); err != nil {
			return operations.Result{}, err
		}
		id, err := q.NewIdentifier(ctx)
		if err != nil {
			return operations.Result{}, err
		}
		w, err := s.ledger(ctx, q, a.OrganizationID, id, "mock_credit", c.AmountMinor, 0)
		if err != nil {
			return operations.Result{}, err
		}
		err = s.emit(ctx, tx, q, a.OrganizationID, "wallet.updated", id)
		return operations.Result{ID: id, Status: "completed", Wallet: &w}, err
	case "purchase":
		return s.purchase(ctx, tx, q, a, c)
	case "release":
		lease, err := q.LockLease(ctx, db.LockLeaseParams{ID: c.ResourceID, OrganizationID: a.OrganizationID})
		if errors.Is(err, pgx.ErrNoRows) {
			return operations.Result{}, operations.Fail("not_found")
		}
		if err != nil {
			return operations.Result{}, err
		}
		if lease.Status != "active" {
			return operations.Result{ID: lease.ID, Status: lease.Status}, nil
		}
		if _, err = q.FinishLease(ctx, db.FinishLeaseParams{ID: lease.ID, OrganizationID: a.OrganizationID, Status: "released"}); err != nil {
			return operations.Result{}, err
		}
		if err = q.SetCatalogStatus(ctx, db.SetCatalogStatusParams{ID: lease.CatalogItemID, Status: "quarantined"}); err != nil {
			return operations.Result{}, err
		}
		if err = s.queue(ctx, tx, "unquarantine", lease.CatalogItemID, time.Now().Add(5*time.Minute)); err != nil {
			return operations.Result{}, err
		}
		err = s.emit(ctx, tx, q, a.OrganizationID, "number.updated", lease.ID)
		return operations.Result{ID: lease.ID, Status: "released"}, err
	case "refund":
		if _, err := q.LockWallet(ctx, a.OrganizationID); err != nil {
			return operations.Result{}, err
		}
		order, err := q.LockOrder(ctx, db.LockOrderParams{ID: c.ResourceID, OrganizationID: a.OrganizationID})
		if errors.Is(err, pgx.ErrNoRows) {
			return operations.Result{}, operations.Fail("not_found")
		}
		if err != nil {
			return operations.Result{}, err
		}
		if order.Status != "completed" || time.Since(order.CreatedAt.Time) > 14*24*time.Hour {
			return operations.Result{}, operations.Fail("refund_unavailable")
		}
		active, err := q.OrderHasActiveLease(ctx, order.ID)
		if err != nil {
			return operations.Result{}, err
		}
		if active {
			return operations.Result{}, operations.Fail("release_required")
		}
		w, err := s.ledger(ctx, q, a.OrganizationID, order.ID, "refund", order.AmountMinor, 0)
		if err != nil {
			return operations.Result{}, err
		}
		if err = q.RefundOrder(ctx, db.RefundOrderParams{ID: order.ID, OrganizationID: a.OrganizationID}); err != nil {
			return operations.Result{}, err
		}
		err = s.emit(ctx, tx, q, a.OrganizationID, "wallet.updated", order.ID)
		return operations.Result{ID: order.ID, Status: "refunded", Wallet: &w}, err
	case "simulate":
		if len(c.Body) == 0 {
			c.Body = "[Mock] Your support request has been updated. No live carrier message was received."
		}
		if utf8.RuneCountInString(c.Body) > 1600 {
			return operations.Result{}, operations.Fail("validation_failed")
		}
		l, err := q.LockLease(ctx, db.LockLeaseParams{ID: c.LeaseID, OrganizationID: a.OrganizationID})
		if errors.Is(err, pgx.ErrNoRows) {
			return operations.Result{}, operations.Fail("not_found")
		}
		if err != nil {
			return operations.Result{}, err
		}
		if l.Status != "active" || !l.ExpiresAt.Time.After(time.Now()) {
			return operations.Result{}, operations.Fail("lease_inactive")
		}
		item, err := q.LockCatalogItem(ctx, l.CatalogItemID)
		if err != nil {
			return operations.Result{}, err
		}
		if !contains(item.Capabilities, "sms") {
			return operations.Result{}, operations.Fail("sms_unavailable")
		}
		id, err := q.NewIdentifier(ctx)
		if err != nil {
			return operations.Result{}, err
		}
		body, err := s.seal([]byte(c.Body), a.OrganizationID+":"+id)
		if err != nil {
			return operations.Result{}, err
		}
		raw, err := json.Marshal(operations.Incoming{ID: id, LeaseID: l.ID, Body: c.Body, OccurredAt: time.Now()})
		if err != nil {
			return operations.Result{}, err
		}
		rawCipher, err := s.seal(raw, "provider:"+id)
		if err != nil {
			return operations.Result{}, err
		}
		if err = q.SaveProviderEvent(ctx, db.SaveProviderEventParams{ID: id, LeaseID: l.ID, PayloadHash: hash(string(raw)), PayloadCiphertext: rawCipher, State: "accepted"}); err != nil {
			return operations.Result{}, err
		}
		m, err := q.CreateMessage(ctx, db.CreateMessageParams{ID: id, OrganizationID: a.OrganizationID, LeaseID: l.ID, ProviderEventID: id, PayloadCiphertext: body, ExpiresAt: date(time.Now().Add(30 * 24 * time.Hour))})
		if err != nil {
			return operations.Result{}, err
		}
		if err = s.queue(ctx, tx, "purge_message", m.ID, m.ExpiresAt.Time); err != nil {
			return operations.Result{}, err
		}
		err = s.emit(ctx, tx, q, a.OrganizationID, "message.received", m.ID)
		return operations.Result{ID: m.ID, Status: "received"}, err
	case "delete_message":
		count, err := q.DeleteMessage(ctx, db.DeleteMessageParams{ID: c.ResourceID, OrganizationID: a.OrganizationID})
		if err != nil {
			return operations.Result{}, err
		}
		if count == 0 {
			return operations.Result{}, operations.Fail("not_found")
		}
		err = s.emit(ctx, tx, q, a.OrganizationID, "message.deleted", c.ResourceID)
		return operations.Result{ID: c.ResourceID, Status: "deleted"}, err
	case "create_key", "revoke_key", "create_webhook", "toggle_webhook", "test_webhook":
		return s.developer(ctx, tx, q, a, c)
	default:
		return operations.Result{}, operations.Fail("validation_failed")
	}
}
func contains(values []string, match string) bool {
	for _, v := range values {
		if v == match {
			return true
		}
	}
	return false
}
func (s *Store) purchase(ctx context.Context, tx pgx.Tx, q *db.Queries, a operations.Actor, c operations.Command) (operations.Result, error) {
	if !c.ConfirmedTerms || !contains([]string{"customer_support", "product_notifications", "service_testing"}, c.Purpose) || strings.TrimSpace(c.CatalogItemID) == "" {
		return operations.Result{}, operations.Fail("validation_failed")
	}
	// All purchase/refund flows lock wallet before inventory to avoid lock inversion.
	w, err := q.LockWallet(ctx, a.OrganizationID)
	if err != nil {
		return operations.Result{}, err
	}
	item, err := q.LockCatalogItem(ctx, c.CatalogItemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return operations.Result{}, operations.Fail("not_found")
	}
	if err != nil {
		return operations.Result{}, err
	}
	if item.Status != "available" {
		return operations.Result{}, operations.Fail("inventory_unavailable")
	}
	price := int64(item.MonthlyFeeMinor)
	if w.AvailableMinor < price {
		return operations.Result{}, operations.Fail("insufficient_balance")
	}
	orderID, err := q.NewIdentifier(ctx)
	if err != nil {
		return operations.Result{}, err
	}
	if _, err = s.ledger(ctx, q, a.OrganizationID, orderID, "reserve", -price, price); err != nil {
		return operations.Result{}, err
	}
	reference, providerErr := s.provider.Provision(ctx, orderID, c.SimulateFailure)
	state, failure := "completed", ""
	if providerErr != nil {
		if ctx.Err() != nil {
			return operations.Result{}, ctx.Err()
		}
		state, failure = "failed", "mock_provider_failure"
	}
	order, err := q.CreateOrderWithID(ctx, db.CreateOrderWithIDParams{ID: orderID, OrganizationID: a.OrganizationID, UserID: a.UserID, CatalogItemID: item.ID, Status: state, Purpose: c.Purpose, AmountMinor: price, FailureCode: failure})
	if err != nil {
		return operations.Result{}, err
	}
	output := operations.Order{ID: order.ID, E164: item.E164, Status: order.Status, Purpose: order.Purpose, AmountMinor: order.AmountMinor, FailureCode: order.FailureCode, CreatedAt: order.CreatedAt.Time}
	result := operations.Result{ID: order.ID, Status: state, Order: &output}
	if providerErr != nil {
		updated, err := s.ledger(ctx, q, a.OrganizationID, order.ID, "release", price, -price)
		if err != nil {
			return result, err
		}
		result.Wallet = &updated
	} else {
		updated, err := s.ledger(ctx, q, a.OrganizationID, order.ID, "settle", 0, -price)
		if err != nil {
			return result, err
		}
		result.Wallet = &updated
		lease, err := q.CreateLease(ctx, db.CreateLeaseParams{OrganizationID: a.OrganizationID, OrderID: order.ID, CatalogItemID: item.ID, ProviderReference: reference, ExpiresAt: date(time.Now().Add(30 * 24 * time.Hour))})
		if err != nil {
			return result, err
		}
		if err = q.SetCatalogStatus(ctx, db.SetCatalogStatusParams{ID: item.ID, Status: "allocated"}); err != nil {
			return result, err
		}
		if err = s.queue(ctx, tx, "expire_lease", lease.ID, lease.ExpiresAt.Time); err != nil {
			return result, err
		}
		result.Number = &operations.Number{ID: lease.ID, E164: item.E164, Status: "active", CountryCode: item.CountryCode, NumberType: item.NumberType, Capabilities: item.Capabilities, MonthlyFeeMinor: item.MonthlyFeeMinor, StartedAt: lease.StartedAt.Time, ExpiresAt: lease.ExpiresAt.Time, OrderID: order.ID}
	}
	if err = s.emit(ctx, tx, q, a.OrganizationID, "order.updated", order.ID); err != nil {
		return result, err
	}
	return result, s.emit(ctx, tx, q, a.OrganizationID, "wallet.updated", order.ID)
}
