package server_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
	"testing"

	"numdock/backend/internal/platform/config"
)

func seedAuthLimit(t *testing.T, f fixture, key string, attempts int) {
	t.Helper()
	hash := sha256.Sum256([]byte(key))
	_, err := f.pool.Exec(context.Background(),
		`INSERT INTO auth_rate_limits (key, attempts, expires_at)
		 VALUES ($1, $2, now() + interval '1 minute')
		 ON CONFLICT (key) DO UPDATE SET attempts = excluded.attempts, expires_at = excluded.expires_at`,
		hex.EncodeToString(hash[:]), attempts)
	if err != nil {
		t.Fatal(err)
	}
}

func loginWithForwardedFor(t *testing.T, client *http.Client, endpoint, csrf, forwarded string) (int, http.Header) {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://client.test")
	req.Header.Set("X-CSRF-Token", csrf)
	req.Header.Set("X-Forwarded-For", forwarded)
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode, resp.Header
}

func TestTrustedProxyUsesForwardedClientIPForRateLimit(t *testing.T) {
	f := setupWithConfig(t, config.Config{
		AppOrigin:      "http://client.test",
		TrustedProxies: []string{"127.0.0.1"},
	})
	client := newClient(t)
	csrf := token(t, f, client)
	seedAuthLimit(t, f, "ip:203.0.113.10", 20)

	status, headers := loginWithForwardedFor(t, client, f.server.URL+"/v1/auth/login", csrf, "198.51.100.7, 203.0.113.10")
	if status != http.StatusTooManyRequests {
		t.Fatalf("trusted proxy limit status = %d, want %d", status, http.StatusTooManyRequests)
	}
	if headers.Get("Retry-After") != "60" {
		t.Fatalf("Retry-After = %q", headers.Get("Retry-After"))
	}
}

func TestUntrustedForwardedHeaderIsIgnoredForRateLimit(t *testing.T) {
	f := setup(t)
	client := newClient(t)
	csrf := token(t, f, client)
	// If the forwarded address were trusted, this bucket would block the request.
	seedAuthLimit(t, f, "ip:203.0.113.10", 20)

	status, _ := loginWithForwardedFor(t, client, f.server.URL+"/v1/auth/login", csrf, "198.51.100.7, 203.0.113.10")
	if status == http.StatusTooManyRequests {
		t.Fatal("untrusted X-Forwarded-For influenced rate limiting")
	}
	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", status, http.StatusBadRequest)
	}
}
