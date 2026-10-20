package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"numdock/backend/internal/auth"
	"numdock/backend/internal/config"
	"numdock/backend/internal/httpx"
)

func New(pool *pgxpool.Pool, c config.Config, logger *slog.Logger) (http.Handler, error) {
	identity, err := auth.New(pool, c.AppOrigin, c.SecureCookies, logger)
	if err != nil {
		return nil, err
	}
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			started := time.Now()
			w.Header().Set("X-Request-ID", middleware.GetReqID(r.Context()))
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Referrer-Policy", "no-referrer")
			wrapped := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(wrapped, r)
			logger.InfoContext(r.Context(), "http request", "method", r.Method, "status", wrapped.Status(), "request_id", middleware.GetReqID(r.Context()), "duration_ms", time.Since(started).Milliseconds())
		})
	})
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recover() != nil {
					logger.ErrorContext(r.Context(), "request panic", "request_id", middleware.GetReqID(r.Context()))
					httpx.Fail(w, r, 500, "internal_error", "We could not complete this request.")
				}
			}()
			next.ServeHTTP(w, r)
		})
	})
	r.Use(middleware.Timeout(15 * time.Second))
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, 200, struct {
			Status string `json:"status"`
		}{"ok"})
	})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			httpx.Fail(w, r, 503, "not_ready", "Database is unavailable.")
			return
		}
		httpx.JSON(w, 200, struct {
			Status string `json:"status"`
		}{"ready"})
	})
	r.Route("/v1", identity.Routes)
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, 404, "not_found", "This endpoint does not exist.")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, 405, "method_not_allowed", "This method is not supported.")
	})
	return r, nil
}
