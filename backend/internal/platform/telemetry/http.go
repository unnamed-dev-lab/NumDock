package telemetry

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"net/http"
	"numdock/backend/internal/platform/httpx"
	"time"
)

// NewHTTPMiddleware deliberately does not record URLs, query strings, headers,
// cookies, bodies, email, phone numbers, organization IDs, or SQL arguments.
func NewHTTPMiddleware(tp trace.TracerProvider, mp metric.MeterProvider) (func(http.Handler) http.Handler, error) {
	tracer := tp.Tracer("numdock/http")
	meter := mp.Meter("numdock/http")
	requests, err := meter.Int64Counter("numdock.http.server.requests", metric.WithDescription("Completed HTTP requests"))
	if err != nil {
		return nil, err
	}
	duration, err := meter.Float64Histogram("http.server.request.duration", metric.WithUnit("s"), metric.WithExplicitBucketBoundaries(.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 15))
	if err != nil {
		return nil, err
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			method := r.Method
			switch method {
			case "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE":
			default:
				method = "_OTHER"
			}
			// Propagate trace context only, never arbitrary baggage from clients.
			ctx := propagation.TraceContext{}.Extract(r.Context(), propagation.HeaderCarrier(r.Header))
			ctx, span := tracer.Start(ctx, "HTTP request", trace.WithSpanKind(trace.SpanKindServer))
			defer span.End()
			if span.SpanContext().IsValid() {
				w.Header().Set("X-Trace-ID", span.SpanContext().TraceID().String())
			}
			span.SetAttributes(attribute.String("numdock.request_id", httpx.RequestID(ctx)))
			wrapped := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			started := time.Now()
			defer func() {
				route := "unmatched"
				if rc := chi.RouteContext(r.Context()); rc != nil && rc.RoutePattern() != "" {
					route = rc.RoutePattern()
				}
				status := wrapped.Status()
				if status == 0 {
					status = http.StatusOK
				}
				attrs := []attribute.KeyValue{attribute.String("http.request.method", method), attribute.String("http.route", route), attribute.Int("http.response.status_code", status)}
				span.SetName(method + " " + route)
				span.SetAttributes(attrs...)
				if status >= 500 {
					span.SetStatus(codes.Error, "HTTP server error")
				}
				requests.Add(ctx, 1, metric.WithAttributes(attrs...))
				duration.Record(ctx, time.Since(started).Seconds(), metric.WithAttributes(attrs...))
			}()
			next.ServeHTTP(wrapped, r.WithContext(ctx))
		})
	}, nil
}
