package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"numdock/backend/internal/operations"
	db "numdock/backend/internal/operations/postgres/db"
	"time"
)

func paymentValue(p db.PaymentOrder) operations.Payment {
	return operations.Payment{ID: p.ID, Reference: p.Reference, AmountMinor: p.AmountMinor, Currency: p.Currency, Provider: p.Provider, Status: p.Status, CreatedAt: p.CreatedAt.Time, ExpiresAt: p.ExpiresAt.Time}
}
func (s *Store) payment(ctx context.Context, tx pgx.Tx, q *db.Queries, a operations.Actor, c operations.Command) (operations.Result, error) {
	if a.KeyID != "" {
		return operations.Result{}, operations.Fail("forbidden")
	}
	if c.Kind == "create_payment" {
		if c.AmountMinor < 100 || c.AmountMinor > 1000000 {
			return operations.Result{}, operations.Fail("validation_failed")
		}
		// Serialize with other payments for this account and bound abandoned checkouts.
		if _, err := q.LockWallet(ctx, a.OrganizationID); err != nil {
			return operations.Result{}, err
		}
		pending, err := q.CountPayments(ctx, db.CountPaymentsParams{OrganizationID: a.OrganizationID, Status: "pending"})
		if err != nil {
			return operations.Result{}, err
		}
		if pending >= 10 {
			return operations.Result{}, operations.Fail("resource_limit")
		}
		p, err := q.CreatePayment(ctx, db.CreatePaymentParams{OrganizationID: a.OrganizationID, UserID: a.UserID, AmountMinor: c.AmountMinor})
		if err != nil {
			return operations.Result{}, err
		}
		if err = s.queue(ctx, tx, "expire_payment", p.ID, p.ExpiresAt.Time); err != nil {
			return operations.Result{}, err
		}
		if err = s.emit(ctx, tx, q, a.OrganizationID, "payment.updated", p.ID); err != nil {
			return operations.Result{}, err
		}
		out := paymentValue(p)
		return operations.Result{ID: p.ID, Status: p.Status, Payment: &out}, nil
	}
	// Use the same wallet-before-resource ordering as leasing and refunds.
	if _, err := q.LockWallet(ctx, a.OrganizationID); err != nil {
		return operations.Result{}, err
	}
	p, err := q.LockPayment(ctx, db.LockPaymentParams{ID: c.ResourceID, OrganizationID: a.OrganizationID})
	if errors.Is(err, pgx.ErrNoRows) {
		return operations.Result{}, operations.Fail("not_found")
	}
	if err != nil {
		return operations.Result{}, err
	}
	out := paymentValue(p)
	result := operations.Result{ID: p.ID, Status: p.Status, Payment: &out}
	if p.Status != "pending" {
		return result, nil
	}
	state := "succeeded"
	if !p.ExpiresAt.Time.After(time.Now()) {
		state = "expired"
	} else if c.Kind == "cancel_payment" {
		state = "canceled"
	} else if c.SimulateFailure {
		state = "failed"
	}
	p, err = q.FinishPayment(ctx, db.FinishPaymentParams{ID: p.ID, OrganizationID: a.OrganizationID, Status: state})
	if err != nil {
		return operations.Result{}, err
	}
	if state == "succeeded" {
		// Amount and currency come only from the locked order, never the browser.
		w, e := s.ledger(ctx, q, a.OrganizationID, p.ID, "payment_credit", p.AmountMinor, 0)
		if e != nil {
			return operations.Result{}, e
		}
		result.Wallet = &w
		if err = s.emit(ctx, tx, q, a.OrganizationID, "wallet.updated", p.ID); err != nil {
			return operations.Result{}, err
		}
	}
	out = paymentValue(p)
	result.Status = state
	result.Payment = &out
	return result, s.emit(ctx, tx, q, a.OrganizationID, "payment.updated", p.ID)
}
