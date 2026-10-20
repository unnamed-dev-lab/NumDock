package httpserver

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"numdock/backend/internal/platform/httpx"
)

const statusClientClosedRequest = 499

type statusWriter interface {
	Status() int
}

func ensureStatusWriter(w http.ResponseWriter, r *http.Request) (http.ResponseWriter, statusWriter) {
	if sw, ok := w.(statusWriter); ok {
		return w, sw
	}
	wrapped := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
	return wrapped, wrapped
}

// RequestID ignores client-supplied request IDs and always generates a fresh
// server-side value. This keeps audit logs and error envelopes trustworthy.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := httpx.NewRequestID()
		w.Header().Set("X-Request-ID", id)
		// Make the server-generated value authoritative for downstream
		// middleware and handlers as well as for the response.
		r.Header.Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(httpx.WithRequestID(r.Context(), id)))
	})
}

func Logging(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			started := time.Now()
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Referrer-Policy", "no-referrer")
			wrapped := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			defer func() {
				status := wrapped.Status()
				if status == 0 {
					status = http.StatusInternalServerError
					if r.Context().Err() == context.Canceled {
						status = statusClientClosedRequest
					}
				}
				logger.InfoContext(r.Context(), "http request",
					"method", r.Method,
					"path", r.URL.Path,
					"status", status,
					"bytes", wrapped.BytesWritten(),
					"request_id", httpx.RequestID(r.Context()),
					"duration_ms", time.Since(started).Milliseconds(),
				)
			}()
			next.ServeHTTP(wrapped, r)
		})
	}
}

func Recoverer(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writer, status := ensureStatusWriter(w, r)
			defer func() {
				panicValue := recover()
				if panicValue == nil {
					return
				}
				// Never log the panic value itself: it can contain request data.
				// The type and stack are enough to locate the fault without
				// leaking submitted message or account content.
				logger.ErrorContext(r.Context(), "request panic",
					"panic_type", fmt.Sprintf("%T", panicValue),
					"stack", string(debug.Stack()),
					"request_id", httpx.RequestID(r.Context()),
					"method", r.Method,
					"path", r.URL.Path,
					"response_started", status.Status() != 0,
				)
				if status.Status() != 0 {
					return
				}
				httpx.Fail(writer, r, http.StatusInternalServerError, "internal_error", "We could not complete this request.")
			}()
			next.ServeHTTP(writer, r)
		})
	}
}

// timeout cancels the request context after d. Handlers that observe the
// deadline may write their own 504; if they return without writing anything,
// this middleware supplies the error envelope. It never overwrites a response
// that has already started, avoiding duplicate WriteHeader calls.
func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			writer, status := ensureStatusWriter(w, r)
			next.ServeHTTP(writer, r.WithContext(ctx))
			if ctx.Err() == context.DeadlineExceeded && status.Status() == 0 {
				httpx.Fail(writer, r.WithContext(ctx), http.StatusGatewayTimeout, "request_timeout", "The request took too long. Please try again.")
			}
		})
	}
}
