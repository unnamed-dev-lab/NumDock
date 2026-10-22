package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"numdock/backend/internal/catalog"
	catalogdb "numdock/backend/internal/catalog/postgres/db"
)

type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

func (s *Store) List(ctx context.Context, f catalog.Filter) ([]catalog.Item, int64, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback(ctx)
	q := catalogdb.New(tx)
	total, err := q.CountCatalogItems(ctx, catalogdb.CountCatalogItemsParams{Country: f.Country, NumberType: f.NumberType, Capability: f.Capability, UseCase: f.UseCase, Search: f.Search})
	if err != nil {
		return nil, 0, err
	}
	rows, err := q.ListCatalogItems(ctx, catalogdb.ListCatalogItemsParams{Country: f.Country, NumberType: f.NumberType, Capability: f.Capability, UseCase: f.UseCase, Search: f.Search, SortBy: f.SortBy, SortOrder: f.SortOrder, PageLimit: f.Limit, PageOffset: f.Offset})
	if err != nil {
		return nil, 0, err
	}
	items := make([]catalog.Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, catalog.Item{ID: row.ID, E164: row.E164, CountryCode: row.CountryCode, CountryName: row.CountryName, Region: row.Region, NumberType: row.NumberType, Capabilities: row.Capabilities, UseCases: row.UseCases, Provider: row.Provider, Source: row.Source, Currency: row.Currency, MonthlyFeeMinor: row.MonthlyFeeMinor, InboundSMSFeeMicros: row.InboundSmsFeeMicros, Status: row.Status})
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
