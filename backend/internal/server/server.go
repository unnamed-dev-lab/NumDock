package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"go.opentelemetry.io/otel"
	"numdock/backend/internal/catalog"
	cataloghttp "numdock/backend/internal/catalog/httpapi"
	catalogpostgres "numdock/backend/internal/catalog/postgres"
	"numdock/backend/internal/identity"
	identityhttp "numdock/backend/internal/identity/httpapi"
	identitypostgres "numdock/backend/internal/identity/postgres"
	operationshttp "numdock/backend/internal/operations/httpapi"
	operationsruntime "numdock/backend/internal/operations/runtime"
	"numdock/backend/internal/overview"
	overviewhttp "numdock/backend/internal/overview/httpapi"
	overviewpostgres "numdock/backend/internal/overview/postgres"
	"numdock/backend/internal/platform/config"
	"numdock/backend/internal/platform/httpserver"
	"numdock/backend/internal/platform/httpx"
	"numdock/backend/internal/platform/telemetry"
	"numdock/backend/openapi"
)

const requestTimeout = 15 * time.Second

type Option func(*options)
type options struct{ runtime *operationsruntime.Runtime }

func WithOperations(runtime *operationsruntime.Runtime) Option {
	return func(o *options) { o.runtime = runtime }
}

func New(pool *pgxpool.Pool, c config.Config, logger *slog.Logger, opts ...Option) (http.Handler, error) {
	clientIP, err := httpserver.NewClientIPResolver(c.TrustedProxies)
	if err != nil {
		return nil, err
	}
	identityService, err := identity.NewService(identitypostgres.New(pool))
	if err != nil {
		return nil, err
	}
	identityHandler := identityhttp.New(identityService, c.AppOrigin, c.SecureCookies, logger, clientIP)
	o := options{}
	for _, opt := range opts {
		opt(&o)
	}
	if o.runtime == nil {
		o.runtime, err = operationsruntime.New(pool, c.DataEncryptionKey, c.Environment == "development", logger)
		if err != nil {
			return nil, err
		}
	}
	r := chi.NewRouter()
	r.Use(httpserver.RequestID)
	if c.TelemetryEnabled {
		instrument, err := telemetry.NewHTTPMiddleware(otel.GetTracerProvider(), otel.GetMeterProvider())
		if err != nil {
			return nil, err
		}
		r.Use(instrument)
	}
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
		v1.Get("/status", publicStatusHandler(pool, c.Environment == "development"))
		v1.Get("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
			_, _ = w.Write(openapi.Spec)
		})
		overviewhttp.New(overview.NewService(overviewpostgres.New(pool), c.Environment == "development", overview.Telemetry{Instrumented: c.TelemetryEnabled, ExporterConfigured: c.TelemetryEnabled && c.TelemetryEndpoint != ""}), logger).Routes(v1, identityHandler.Authenticate)
		identityHandler.Routes(v1)
		operationshttp.New(o.runtime.Store, identityHandler, logger, c.DataEncryptionKey).Routes(v1)
		cataloghttp.New(catalog.NewService(catalogpostgres.New(pool), c.Environment == "development"), logger).Routes(v1)
	})
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, 404, "not_found", "This endpoint does not exist.")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, 405, "method_not_allowed", "This method is not supported.")
	})
	return r, nil
}
