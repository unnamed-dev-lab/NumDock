package postgres

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"numdock/backend/internal/overview"
	overviewdb "numdock/backend/internal/overview/postgres/db"
	"time"
)

type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

func (s *Store) Snapshot(ctx context.Context, userID, organizationID string, start, end time.Time, includeDemo bool) (overview.Snapshot, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return overview.Snapshot{}, err
	}
	defer tx.Rollback(ctx)
	q := overviewdb.New(tx)
	member, err := q.HasOverviewMembership(ctx, overviewdb.HasOverviewMembershipParams{UserID: userID, OrganizationID: organizationID})
	if err != nil {
		return overview.Snapshot{}, err
	}
	if !member {
		return overview.Snapshot{}, overview.ErrNotFound
	}
	result := overview.Snapshot{Days: []overview.Day{}}
	if includeDemo {
		rows, err := q.ListOverviewDays(ctx, overviewdb.ListOverviewDaysParams{UserID: userID, OrganizationID: organizationID, StartDay: pgtype.Date{Time: start, Valid: true}, EndDay: pgtype.Date{Time: end, Valid: true}})
		if err != nil {
			return overview.Snapshot{}, err
		}
		for _, row := range rows {
			result.Days = append(result.Days, overview.Day{Date: row.Day.Time.Format(time.DateOnly), ActiveNumbers: int64(row.ActiveNumbers), MessagesReceived: int64(row.MessagesReceived), MessagesFailed: int64(row.MessagesFailed), OrdersCompleted: int64(row.OrdersCompleted), SpendMinor: int64(row.SpendMinor)})
			if result.SeededAt == nil || row.SeededAt.Time.After(*result.SeededAt) {
				timestamp := row.SeededAt.Time
				result.SeededAt = &timestamp
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return overview.Snapshot{}, err
	}
	return result, nil
}
