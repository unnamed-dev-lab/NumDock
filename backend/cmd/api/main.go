package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"numdock/backend/db"
	"numdock/backend/internal/devseed"
	identitypostgres "numdock/backend/internal/identity/postgres"
	"numdock/backend/internal/platform/config"
	"numdock/backend/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("application stopped", "error", err.Error())
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	migrate := flag.Bool("migrate", false, "apply database migrations and exit")
	seed := flag.Bool("seed", false, "initialize development fixtures and exit (requires APP_ENV=development)")
	flag.Parse()
	if *migrate && *seed {
		return errors.New("run -migrate and -seed separately")
	}
	c, err := config.Load()
	if err != nil {
		return err
	}
	if *seed && c.Environment != "development" {
		return errors.New("seed requires APP_ENV=development")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if *migrate {
		return db.Migrate(ctx, c.DatabaseURL)
	}
	poolConfig, err := pgxpool.ParseConfig(c.DatabaseURL)
	if err != nil {
		return errors.New("invalid DATABASE_URL")
	}
	poolConfig.MaxConns = 10
	poolConfig.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return errors.New("could not create database pool")
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return errors.New("database connection failed")
	}
	if *seed {
		seedCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		if err := devseed.Run(seedCtx, pool, c.Environment, os.Getenv("DEV_SEED_PASSWORD")); err != nil {
			return err
		}
		logger.Info("development fixtures ready", "users", 4, "organizations", 2, "catalog_items", 24)
		return nil
	}
	handler, err := server.New(pool, c, logger)
	if err != nil {
		return err
	}
	srv := &http.Server{Addr: c.Address, Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: time.Minute, MaxHeaderBytes: 16 * 1024}
	failures := make(chan error, 1)
	go func() { logger.Info("api listening", "address", c.Address); failures <- srv.ListenAndServe() }()
	// Housekeeping is best effort. Durable business jobs will use River in their own slice.
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			cleanupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			q := identitypostgres.New(pool)
			if err := q.PruneAuthLimits(cleanupCtx); err != nil {
				logger.Warn("auth limit cleanup failed")
			}
			if err := q.PruneSessions(cleanupCtx); err != nil {
				logger.Warn("session cleanup failed")
			}
			cancel()
		case err := <-failures:
			if errors.Is(err, http.ErrServerClosed) {
				return nil
			}
			return err
		case <-ctx.Done():
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			return srv.Shutdown(shutdownCtx)
		}
	}
}
