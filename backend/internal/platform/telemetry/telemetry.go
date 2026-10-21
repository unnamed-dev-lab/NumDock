// Package telemetry instruments bounded, privacy-safe HTTP signals. Business
// dashboards stay in PostgreSQL and never read global process metrics.
package telemetry

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"numdock/backend/internal/platform/config"
)

func Init(ctx context.Context, c config.Config, logger *slog.Logger) (func(context.Context) error, error) {
	if !c.TelemetryEnabled {
		return func(context.Context) error { return nil }, nil
	}
	res := resource.NewWithAttributes("", attribute.String("service.name", c.TelemetryServiceName), attribute.String("deployment.environment.name", c.Environment))
	traceOptions := []sdktrace.TracerProviderOption{sdktrace.WithResource(res)}
	metricOptions := []sdkmetric.Option{sdkmetric.WithResource(res)}
	endpoint := strings.TrimRight(c.TelemetryEndpoint, "/")
	if endpoint != "" {
		traceExporter, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpointURL(endpoint+"/v1/traces"), otlptracehttp.WithTimeout(3*time.Second))
		if err != nil {
			return nil, errors.New("could not initialize trace exporter")
		}
		metricExporter, err := otlpmetrichttp.New(ctx, otlpmetrichttp.WithEndpointURL(endpoint+"/v1/metrics"), otlpmetrichttp.WithTimeout(3*time.Second))
		if err != nil {
			_ = traceExporter.Shutdown(ctx)
			return nil, errors.New("could not initialize metric exporter")
		}
		traceOptions = append(traceOptions, sdktrace.WithBatcher(traceExporter))
		metricOptions = append(metricOptions, sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter, sdkmetric.WithInterval(10*time.Second))))
	} else {
		// Bounded in-memory aggregation only. No claim of collector connectivity.
		metricOptions = append(metricOptions, sdkmetric.WithReader(sdkmetric.NewManualReader()))
	}
	traces := sdktrace.NewTracerProvider(traceOptions...)
	metrics := sdkmetric.NewMeterProvider(metricOptions...)
	otel.SetTracerProvider(traces)
	otel.SetMeterProvider(metrics)
	// Exporter errors may contain configured credentials or network details.
	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(error) { logger.Warn("telemetry export failed") }))
	logger.Info("telemetry initialized", "service", c.TelemetryServiceName, "otlp_configured", endpoint != "")
	return func(ctx context.Context) error { return errors.Join(traces.Shutdown(ctx), metrics.Shutdown(ctx)) }, nil
}
