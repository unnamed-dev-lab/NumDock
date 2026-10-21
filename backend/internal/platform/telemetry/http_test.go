package telemetry

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/otel"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"numdock/backend/internal/platform/config"
	"numdock/backend/internal/platform/httpserver"
)

func TestHTTPInstrumentationDoesNotExportRequestData(t *testing.T) {
	exporter := tracetest.NewInMemoryExporter()
	tp := sdktrace.NewTracerProvider(sdktrace.WithSyncer(exporter))
	defer tp.Shutdown(context.Background())
	reader := sdkmetric.NewManualReader()
	mp := sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader))
	defer mp.Shutdown(context.Background())
	instrument, err := NewHTTPMiddleware(tp, mp)
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	router.Use(httpserver.RequestID, instrument)
	router.Post("/v1/organizations/{organization_id}/example", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) })
	req := httptest.NewRequest("POST", "/v1/organizations/private-org/example?password=private-password", strings.NewReader(`{"sms":"private-message"}`))
	req.Header.Set("Cookie", "session=private-cookie")
	req.Header.Set("Authorization", "Bearer private-key")
	req.Header.Set("Baggage", "secret=private-baggage")
	req.Header.Set("traceparent", "00-11111111111111111111111111111111-2222222222222222-01")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	spans := exporter.GetSpans()
	if len(spans) != 1 || spans[0].Name != "POST /v1/organizations/{organization_id}/example" {
		t.Fatalf("incorrect route span: %v", spans)
	}
	if response.Header().Get("X-Trace-ID") != "11111111111111111111111111111111" {
		t.Fatal("trace context was not propagated")
	}
	var data metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &data); err != nil {
		t.Fatal(err)
	}
	signals := 0
	for _, scope := range data.ScopeMetrics {
		for _, m := range scope.Metrics {
			switch d := m.Data.(type) {
			case metricdata.Sum[int64]:
				if len(d.DataPoints) != 1 || d.DataPoints[0].Value != 1 {
					t.Fatal("request count incorrect")
				}
				signals++
			case metricdata.Histogram[float64]:
				if len(d.DataPoints) != 1 || d.DataPoints[0].Count != 1 {
					t.Fatal("duration histogram missing")
				}
				signals++
			}
		}
	}
	if signals != 2 {
		t.Fatal("expected request and duration instruments")
	}
	encoded := fmt.Sprintf("%+v %+v", spans, data)
	for _, secret := range []string{"private-org", "private-password", "private-message", "private-cookie", "private-key", "private-baggage"} {
		if strings.Contains(encoded, secret) {
			t.Fatalf("request data reached telemetry: %s", secret)
		}
	}
}

func TestOTLPHTTPExportsTracesAndMetrics(t *testing.T) {
	var mu sync.Mutex
	received := map[string][]byte{}
	collector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(500)
			return
		}
		mu.Lock()
		received[r.URL.Path] = append(received[r.URL.Path], body...)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/x-protobuf")
	}))
	defer collector.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	shutdown, err := Init(ctx, config.Config{TelemetryEnabled: true, TelemetryEndpoint: collector.URL, TelemetryServiceName: "numdock-api-test", Environment: "test"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	defer shutdown(context.Background())
	instrument, err := NewHTTPMiddleware(otel.GetTracerProvider(), otel.GetMeterProvider())
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	router.Use(httpserver.RequestID, instrument)
	router.Get("/v1/example", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/v1/example?password=do-not-export-this", nil))
	if err := otel.GetTracerProvider().(*sdktrace.TracerProvider).ForceFlush(ctx); err != nil {
		t.Fatal(err)
	}
	if err := otel.GetMeterProvider().(*sdkmetric.MeterProvider).ForceFlush(ctx); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	for _, path := range []string{"/v1/traces", "/v1/metrics"} {
		body := received[path]
		if len(body) == 0 || !bytes.Contains(body, []byte("numdock-api-test")) {
			t.Fatalf("missing OTLP payload: %s", path)
		}
		if bytes.Contains(body, []byte("do-not-export-this")) {
			t.Fatal("query reached OTLP export")
		}
	}
}
