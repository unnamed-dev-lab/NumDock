package config

import (
	"encoding/base64"
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DataEncryptionKey    []byte
	TelemetryEnabled     bool
	TelemetryEndpoint    string
	TelemetryServiceName string
	Environment          string
	DatabaseURL          string
	Address              string
	AppOrigin            string
	SecureCookies        bool
	TrustedProxies       []string
}

func Load() (Config, error) {
	c := Config{
		Environment:    os.Getenv("APP_ENV"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		Address:        os.Getenv("HTTP_ADDR"),
		AppOrigin:      os.Getenv("APP_ORIGIN"),
		SecureCookies:  os.Getenv("COOKIE_SECURE") != "false",
		TrustedProxies: splitList(os.Getenv("TRUSTED_PROXIES")),
	}
	if c.Environment == "" {
		c.Environment = "production"
	}
	if c.Environment != "production" && c.Environment != "development" && c.Environment != "test" {
		return c, errors.New("APP_ENV must be production, development, or test")
	}
	if raw := os.Getenv("DATA_ENCRYPTION_KEY"); raw != "" {
		var err error
		c.DataEncryptionKey, err = base64.StdEncoding.DecodeString(raw)
		if err != nil || len(c.DataEncryptionKey) != 32 {
			return c, errors.New("DATA_ENCRYPTION_KEY must be base64-encoded 32 bytes")
		}
	}
	if c.Environment == "development" && len(c.DataEncryptionKey) != 32 {
		return c, errors.New("development requires DATA_ENCRYPTION_KEY; use scripts/backend.ps1 to initialize a local key")
	}
	c.TelemetryEnabled = c.Environment == "development"
	if raw := os.Getenv("OTEL_ENABLED"); raw != "" {
		enabled, err := strconv.ParseBool(raw)
		if err != nil {
			return c, errors.New("OTEL_ENABLED must be true or false")
		}
		c.TelemetryEnabled = enabled
	}
	c.TelemetryEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	c.TelemetryServiceName = os.Getenv("OTEL_SERVICE_NAME")
	if c.TelemetryServiceName == "" {
		c.TelemetryServiceName = "numdock-api"
	}
	if c.TelemetryEnabled && c.TelemetryEndpoint != "" {
		endpoint, err := url.Parse(c.TelemetryEndpoint)
		if err != nil || endpoint.Host == "" || (endpoint.Scheme != "http" && endpoint.Scheme != "https") || endpoint.User != nil || endpoint.RawQuery != "" || endpoint.Fragment != "" {
			return c, errors.New("OTEL_EXPORTER_OTLP_ENDPOINT must be an http(s) URL without credentials, query or fragment")
		}
		if protocol := os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"); protocol != "" && protocol != "http/protobuf" {
			return c, errors.New("only OTLP http/protobuf is supported")
		}
	}
	if c.Address == "" {
		c.Address = "127.0.0.1:8080"
	}
	if c.AppOrigin == "" {
		c.AppOrigin = "http://localhost:3000"
	}
	if c.DatabaseURL == "" {
		return c, errors.New("DATABASE_URL is required")
	}
	origin, err := url.Parse(c.AppOrigin)
	if err != nil || origin.Host == "" || (origin.Scheme != "http" && origin.Scheme != "https") || origin.Path != "" || origin.RawQuery != "" || origin.Fragment != "" || origin.User != nil {
		return c, errors.New("APP_ORIGIN must be an http(s) origin without a path")
	}
	local := origin.Hostname() == "localhost" || origin.Hostname() == "127.0.0.1" || origin.Hostname() == "::1"
	if !local && (origin.Scheme != "https" || !c.SecureCookies) {
		return c, errors.New("non-local deployments require HTTPS and secure cookies")
	}
	return c, nil
}

func splitList(value string) []string {
	var result []string
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}
