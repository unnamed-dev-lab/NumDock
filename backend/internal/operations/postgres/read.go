package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"numdock/backend/internal/operations"
	db "numdock/backend/internal/operations/postgres/db"
)

func (s *Store) Read(ctx context.Context, a operations.Actor, f operations.Filter) (operations.Snapshot, error) {
	out := operations.Snapshot{Mode: "disabled", Payments: []operations.Payment{}, Wallet: operations.Wallet{Currency: "USD"}, Numbers: []operations.Number{}, Orders: []operations.Order{}, Ledger: []operations.Ledger{}, Messages: []operations.Message{}, Limit: f.Limit, Offset: f.Offset}
	tx, err := s.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	out.Role, err = role(ctx, q, a, false)
	if err != nil {
		return out, err
	}
	if !s.development {
		return out, tx.Commit(ctx)
	}
	out.Mode = "mock"
	if f.View == "summary" || f.View == "wallet" {
		w, e := q.GetWallet(ctx, a.OrganizationID)
		if e == nil {
			out.Wallet = wallet(w)
		} else if !errors.Is(e, pgx.ErrNoRows) {
			return out, e
		}
		if f.View == "summary" {
			counts, e := q.WorkspaceCounts(ctx, a.OrganizationID)
			if e != nil {
				return out, e
			}
			out.Counts = operations.Counts{Numbers: counts.Numbers, UnreadMessages: counts.UnreadMessages, CompletedOrders: counts.CompletedOrders}
		}
		return out, tx.Commit(ctx)
	}
	switch f.View {
	case "numbers":
		rows, e := q.ListNumbers(ctx, db.ListNumbersParams{OrganizationID: a.OrganizationID, Status: f.Status, Search: f.Search, PageLimit: f.Limit, PageOffset: f.Offset})
		if e != nil {
			return out, e
		}
		for _, r := range rows {
			out.Numbers = append(out.Numbers, operations.Number{ID: r.ID, E164: r.E164, Status: r.Status, CountryCode: r.CountryCode, NumberType: r.NumberType, Capabilities: r.Capabilities, UseCases: r.UseCases, MonthlyFeeMinor: r.MonthlyFeeMinor, RentalDays: r.RentalDays, AmountMinor: r.AmountMinor, StartedAt: r.StartedAt.Time, ExpiresAt: r.ExpiresAt.Time, OrderID: r.OrderID})
		}
		out.Total, err = q.CountNumbers(ctx, db.CountNumbersParams{OrganizationID: a.OrganizationID, Column2: f.Status, Column3: f.Search})
	case "payments":
		rows, e := q.ListPayments(ctx, db.ListPaymentsParams{OrganizationID: a.OrganizationID, Status: f.Status, Search: f.Search, PageLimit: f.Limit, PageOffset: f.Offset})
		if e != nil {
			return out, e
		}
		for _, r := range rows {
			out.Payments = append(out.Payments, operations.Payment{ID: r.ID, Reference: r.Reference, AmountMinor: r.AmountMinor, Currency: r.Currency, Provider: r.Provider, Status: r.Status, CreatedAt: r.CreatedAt.Time, ExpiresAt: r.ExpiresAt.Time})
		}
		out.Total, err = q.CountPayments(ctx, db.CountPaymentsParams{OrganizationID: a.OrganizationID, Status: f.Status, Search: f.Search})
	case "orders":
		rows, e := q.ListOrders(ctx, db.ListOrdersParams{OrganizationID: a.OrganizationID, Column2: f.Status, Limit: f.Limit, Offset: f.Offset})
		if e != nil {
			return out, e
		}
		for _, r := range rows {
			out.Orders = append(out.Orders, operations.Order{ID: r.ID, E164: r.E164, Status: r.Status, Purpose: r.Purpose, AmountMinor: r.AmountMinor, RentalDays: r.RentalDays, FailureCode: r.FailureCode, CreatedAt: r.CreatedAt.Time})
		}
		out.Total, err = q.CountOrders(ctx, db.CountOrdersParams{OrganizationID: a.OrganizationID, Column2: f.Status})
	case "ledger":
		rows, e := q.ListLedger(ctx, db.ListLedgerParams{OrganizationID: a.OrganizationID, Limit: f.Limit, Offset: f.Offset})
		if e != nil {
			return out, e
		}
		for _, r := range rows {
			out.Ledger = append(out.Ledger, operations.Ledger{ID: r.ID, ReferenceID: r.ReferenceID, Kind: r.Kind, AvailableDelta: r.AvailableDelta, ReservedDelta: r.ReservedDelta, AvailableAfter: r.AvailableAfter, ReservedAfter: r.ReservedAfter, CreatedAt: r.CreatedAt.Time})
		}
		out.Total, err = q.CountLedger(ctx, a.OrganizationID)
	case "messages":
		rows, e := q.ListMessages(ctx, db.ListMessagesParams{OrganizationID: a.OrganizationID, Column2: f.Status, Limit: f.Limit, Offset: f.Offset})
		if e != nil {
			return out, e
		}
		for _, r := range rows {
			out.Messages = append(out.Messages, operations.Message{ID: r.ID, LeaseID: r.LeaseID, E164: r.E164, ReceivedAt: r.ReceivedAt.Time, ExpiresAt: r.ExpiresAt.Time, Read: r.ReadAt.Valid})
		}
		out.Total, err = q.CountMessages(ctx, db.CountMessagesParams{OrganizationID: a.OrganizationID, Column2: f.Status})
	default:
		return out, operations.Fail("validation_failed")
	}
	if err != nil {
		return out, err
	}
	return out, tx.Commit(ctx)
}
func (s *Store) Message(ctx context.Context, a operations.Actor, id string) (operations.Message, error) {
	var out operations.Message
	if !s.development {
		return out, operations.Fail("feature_disabled")
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	if _, err = role(ctx, q, a, false); err != nil {
		return out, err
	}
	row, err := q.ReadMessage(ctx, db.ReadMessageParams{ID: id, OrganizationID: a.OrganizationID})
	if errors.Is(err, pgx.ErrNoRows) {
		return out, operations.Fail("not_found")
	}
	if err != nil {
		return out, err
	}
	body, err := s.open(row.PayloadCiphertext, a.OrganizationID+":"+row.ID)
	if err != nil {
		return out, err
	}
	if err = q.AuditOperation(ctx, db.AuditOperationParams{OrganizationID: a.OrganizationID, UserID: text(a.UserID), Action: "read_message", ResourceID: id}); err != nil {
		return out, err
	}
	if err = s.emit(ctx, tx, q, a.OrganizationID, "message.read", id); err != nil {
		return out, err
	}
	out = operations.Message{ID: id, LeaseID: row.LeaseID, Body: string(body), ReceivedAt: row.ReceivedAt.Time, ExpiresAt: row.ExpiresAt.Time, Read: true}
	return out, tx.Commit(ctx)
}
func (s *Store) Events(ctx context.Context, a operations.Actor, after int64) ([]operations.Event, error) {
	out := []operations.Event{}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx)
	q := db.New(tx)
	if _, err = role(ctx, q, a, false); err != nil {
		return out, err
	}
	if !s.development {
		return out, tx.Commit(ctx)
	}
	rows, err := q.EventsAfter(ctx, db.EventsAfterParams{OrganizationID: a.OrganizationID, ID: after})
	if err != nil {
		return out, err
	}
	for _, r := range rows {
		out = append(out, operations.Event{ID: r.ID, Type: r.Type, ResourceID: r.ResourceID})
	}
	return out, tx.Commit(ctx)
}
