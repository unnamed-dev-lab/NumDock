package db

import (
	"context"
	"database/sql"
	"embed"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
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
	_, err = provider.Up(ctx)
	return err
}
