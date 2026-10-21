package config

import "testing"

func TestTrustedProxyList(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("APP_ORIGIN", "http://localhost:3000")
	t.Setenv("COOKIE_SECURE", "false")
	t.Setenv("TRUSTED_PROXIES", " 127.0.0.1, 10.0.0.0/8 ,, ")

	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(c.TrustedProxies) != 2 || c.TrustedProxies[0] != "127.0.0.1" || c.TrustedProxies[1] != "10.0.0.0/8" {
		t.Fatalf("TrustedProxies = %#v", c.TrustedProxies)
	}

	t.Setenv("TRUSTED_PROXIES", "")
	c, err = Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(c.TrustedProxies) != 0 {
		t.Fatalf("TrustedProxies = %#v", c.TrustedProxies)
	}
}

func TestProductionRequiresSecureOriginAndCookie(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	cases := []struct {
		origin, secure string
		valid          bool
	}{
		{"https://numdock.example", "true", true},
		{"https://numdock.example", "false", false},
		{"http://numdock.example", "true", false},
		{"http://localhost:5173", "false", true},
		{"https://numdock.example/path", "true", false},
		{"https://user:secret@numdock.example", "true", false},
	}
	for _, tc := range cases {
		t.Run(tc.origin+tc.secure, func(t *testing.T) {
			t.Setenv("APP_ORIGIN", tc.origin)
			t.Setenv("COOKIE_SECURE", tc.secure)
			_, err := Load()
			if (err == nil) != tc.valid {
				t.Fatalf("unexpected validity: %v", err)
			}
		})
	}
}

func TestEnvironmentMustBeExplicitForDevelopment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("APP_ORIGIN", "http://localhost:3000")
	t.Setenv("APP_ENV", "")
	c, err := Load()
	if err != nil || c.Environment != "production" {
		t.Fatal("environment did not default to production")
	}
	t.Setenv("APP_ENV", "developmnt")
	if _, err := Load(); err == nil {
		t.Fatal("invalid environment accepted")
	}
}

func TestTelemetryConfiguration(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("APP_ORIGIN", "http://localhost:3000")
	t.Setenv("DATA_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
	t.Setenv("APP_ENV", "development")
	t.Setenv("OTEL_ENABLED", "")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	c, err := Load()
	if err != nil || !c.TelemetryEnabled || c.TelemetryServiceName == "" {
		t.Fatal("development telemetry default incorrect")
	}
	t.Setenv("APP_ENV", "production")
	c, err = Load()
	if err != nil || c.TelemetryEnabled {
		t.Fatal("production telemetry requires explicit enablement")
	}
	t.Setenv("OTEL_ENABLED", "true")
	for _, endpoint := range []string{"https://user:secret@example.test", "not-a-url", "http://localhost:4318?token=secret"} {
		t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint)
		if _, err := Load(); err == nil {
			t.Fatal("invalid OTLP endpoint accepted")
		}
	}
}
