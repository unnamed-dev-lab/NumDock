package db

import (
	"context"
	"database/sql"
	"embed"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
)

//go:embed migrations/*.sql
var migrations embed.FS

func Migrate(ctx context.Context, url string) error {
	conn, err := sql.Open("pgx", url)
	if err != nil {
		return err
	}
	defer conn.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, conn, mustSub())
	if err != nil {
		return err
	}
	if _, err = provider.Up(ctx); err != nil {
		return err
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return err
	}
	defer pool.Close()
	var schema string
	if err = pool.QueryRow(ctx, "SELECT current_schema()").Scan(&schema); err != nil {
		return err
	}
	migrator, err := rivermigrate.New(riverpgxv5.New(pool), &rivermigrate.Config{Schema: schema})
	if err != nil {
		return err
	}
	_, err = migrator.Migrate(ctx, rivermigrate.DirectionUp, nil)
	return err
}
