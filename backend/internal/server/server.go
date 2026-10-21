package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"numdock/backend/internal/catalog"
	cataloghttp "numdock/backend/internal/catalog/httpapi"
	catalogpostgres "numdock/backend/internal/catalog/postgres"
	"numdock/backend/internal/identity"
	identityhttp "numdock/backend/internal/identity/httpapi"
	identitypostgres "numdock/backend/internal/identity/postgres"
	"numdock/backend/internal/platform/config"
	"numdock/backend/internal/platform/httpserver"
	"numdock/backend/internal/platform/httpx"
	"numdock/backend/openapi"
)

const requestTimeout = 15 * time.Second

func New(pool *pgxpool.Pool, c config.Config, logger *slog.Logger) (http.Handler, error) {
	clientIP, err := httpserver.NewClientIPResolver(c.TrustedProxies)
	if err != nil {
		return nil, err
	}
	identityService, err := identity.NewService(identitypostgres.New(pool))
	if err != nil {
		return nil, err
	}
	identityHandler := identityhttp.New(identityService, c.AppOrigin, c.SecureCookies, logger, clientIP)
	r := chi.NewRouter()
	r.Use(httpserver.RequestID)
	r.Use(httpserver.Logging(logger))
	r.Use(httpserver.Recoverer(logger))
	r.Use(httpserver.Timeout(requestTimeout))
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
	r.Route("/v1", func(v1 chi.Router) {
		v1.Get("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
			_, _ = w.Write(openapi.Spec)
		})
		identityHandler.Routes(v1)
		cataloghttp.New(catalog.NewService(catalogpostgres.New(pool), c.Environment == "development"), logger).Routes(v1, identityHandler.Authenticate)
	})
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, 404, "not_found", "This endpoint does not exist.")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, 405, "method_not_allowed", "This method is not supported.")
	})
	return r, nil
}
