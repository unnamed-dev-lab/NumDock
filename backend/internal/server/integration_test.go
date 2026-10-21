package server_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"numdock/backend/db"
	identityhttp "numdock/backend/internal/identity/httpapi"
	"numdock/backend/internal/platform/config"
	"numdock/backend/internal/server"
)

type fixture struct {
	server *httptest.Server
	pool   *pgxpool.Pool
}

func setup(t *testing.T) fixture {
	t.Helper()
	return setupWithConfig(t, config.Config{AppOrigin: "http://client.test"})
}

func setupWithConfig(t *testing.T, cfg config.Config) fixture {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	schema := "test_" + hex.EncodeToString(randomBytes(t, 8))
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE"); admin.Close() })
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	if err := db.Migrate(ctx, parsed.String()); err != nil {
		t.Fatal(err)
	}
	// Verify that migration reruns are safe.
	if err := db.Migrate(ctx, parsed.String()); err != nil {
		t.Fatal(err)
	}
	pool, err := pgxpool.New(ctx, parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if cfg.Environment == "development" && len(cfg.DataEncryptionKey) == 0 {
		cfg.DataEncryptionKey = randomBytes(t, 32)
	}
	router, err := server.New(pool, cfg, slog.New(slog.NewJSONHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	return fixture{srv, pool}
}

func randomBytes(t *testing.T, n int) []byte {
	t.Helper()
	value := make([]byte, n)
	if _, err := rand.Read(value); err != nil {
		t.Fatal(err)
	}
	return value
}
func newClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Client{Jar: jar}
}

func request(t *testing.T, client *http.Client, method, endpoint, token, body, origin string) (int, []byte, http.Header) {
	t.Helper()
	req, err := http.NewRequest(method, endpoint, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", origin)
	req.Header.Set("X-CSRF-Token", token)
	response, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	data, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	assertContract(t, method, req.URL.Path, response.StatusCode, data)
	if response.Header.Get("Cache-Control") != "no-store" || response.Header.Get("X-Request-ID") == "" {
		t.Fatal("missing response safety headers")
	}
	return response.StatusCode, data, response.Header
}

func assertContract(t *testing.T, method, path string, status int, data []byte) {
	t.Helper()
	document, err := openapi3.NewLoader().LoadFromFile("../../openapi/openapi.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if err := document.Validate(context.Background()); err != nil {
		t.Fatal(err)
	}
	item := document.Paths.Find(path)
	if item == nil {
		// Paths.Find compares template shapes, not concrete URLs. Resolve concrete
		// resource IDs so response-contract checks cover parameterized endpoints too.
		segments := strings.Split(path, "/")
		for template, candidate := range document.Paths.Map() {
			if candidate.GetOperation(method) == nil {
				continue
			}
			parts := strings.Split(template, "/")
			if len(parts) != len(segments) {
				continue
			}
			match := true
			for i, part := range parts {
				parameter := strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") && segments[i] != ""
				if part != segments[i] && !parameter {
					match = false
					break
				}
			}
			if match {
				item = candidate
				break
			}
		}
	}
	if item == nil {
		t.Fatalf("endpoint missing from OpenAPI: %s", path)
	}
	operation := item.GetOperation(method)
	if operation == nil {
		t.Fatalf("operation missing from OpenAPI: %s %s", method, path)
	}
	response := operation.Responses.Value(strconv.Itoa(status))
	if response == nil {
		response = operation.Responses.Value("default")
	}
	if response == nil {
		t.Fatalf("response missing from OpenAPI: %s %s %d", method, path, status)
	}
	media := response.Value.Content.Get("application/json")
	if media == nil {
		if len(data) != 0 {
			t.Fatal("unexpected body for bodyless response")
		}
		return
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	if err := media.Schema.Value.VisitJSON(value); err != nil {
		t.Fatalf("response does not match OpenAPI: %s %s %d: %v", method, path, status, err)
	}
}

func token(t *testing.T, f fixture, client *http.Client) string {
	t.Helper()
	status, body, _ := request(t, client, "GET", f.server.URL+"/v1/auth/csrf", "", "", "")
	if status != 200 {
		t.Fatalf("csrf: %d %s", status, body)
	}
	var data struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		t.Fatal(err)
	}
	return data.Token
}

func register(t *testing.T, f fixture, client *http.Client, csrf, email, name string) identityhttp.Identity {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": email, "password": "a sufficiently long passphrase", "name": "Alex", "organization_name": name})
	status, data, header := request(t, client, "POST", f.server.URL+"/v1/auth/register", csrf, string(body), "http://client.test")
	if status != 201 {
		t.Fatalf("register: %d %s", status, data)
	}
	if !strings.Contains(header.Get("Set-Cookie"), "HttpOnly") || !strings.Contains(header.Get("Set-Cookie"), "SameSite=Strict") {
		t.Fatal("insecure session cookie")
	}
	if bytes.Contains(data, []byte("password")) {
		t.Fatal("password leaked in response")
	}
	var identity identityhttp.Identity
	if err := json.Unmarshal(data, &identity); err != nil {
		t.Fatal(err)
	}
	return identity
}

func TestIdentityLifecycleAndTenantIsolation(t *testing.T) {
	f := setup(t)
	alice, bob := newClient(t), newClient(t)
	csrfA, csrfB := token(t, f, alice), token(t, f, bob)
	first := register(t, f, alice, csrfA, "ALICE@example.com", "Alpha")
	second := register(t, f, bob, csrfB, "bob@example.com", "Beta")
	if first.User.Email != "alice@example.com" || first.Organizations[0].Role != "owner" {
		t.Fatal("registration normalization/membership failed")
	}
	if first.Organizations[0].ID == second.Organizations[0].ID {
		t.Fatal("organizations must be independent")
	}

	status, data, _ := request(t, alice, "GET", f.server.URL+"/v1/organizations?limit=1&offset=0&organization_id="+second.Organizations[0].ID, "", "", "")
	if status != 200 || bytes.Contains(data, []byte(second.Organizations[0].ID)) || !bytes.Contains(data, []byte(first.Organizations[0].ID)) {
		t.Fatalf("tenant isolation failed: %d %s", status, data)
	}
	status, _, _ = request(t, alice, "GET", f.server.URL+"/v1/organizations?offset=1", "", "", "")
	if status != 200 {
		t.Fatal("pagination failed")
	}
	status, _, _ = request(t, alice, "GET", f.server.URL+"/v1/organizations?limit=101", "", "", "")
	if status != 400 {
		t.Fatal("invalid pagination accepted")
	}
	status, _, _ = request(t, newClient(t), "GET", f.server.URL+"/v1/me", "", "", "")
	if status != 401 {
		t.Fatal("anonymous access accepted")
	}

	duplicate := `{"email":"alice@example.com","password":"a sufficiently long passphrase","name":"Alex","organization_name":"Orphan"}`
	status, _, _ = request(t, alice, "POST", f.server.URL+"/v1/auth/register", csrfA, duplicate, "http://client.test")
	if status != 409 {
		t.Fatal("duplicate registration accepted")
	}
	var count int
	if err := f.pool.QueryRow(context.Background(), "SELECT count(*) FROM organizations").Scan(&count); err != nil || count != 2 {
		t.Fatal("duplicate registration left partial data")
	}

	for _, check := range []struct{ csrf, origin string }{{csrfA, "https://attacker.example"}, {"invalid", "http://client.test"}} {
		status, _, _ = request(t, alice, "POST", f.server.URL+"/v1/auth/logout", check.csrf, "", check.origin)
		if status != 403 {
			t.Fatal("CSRF protection failed")
		}
	}
	parsed, _ := url.Parse(f.server.URL)
	var saved *http.Cookie
	for _, cookie := range alice.Jar.Cookies(parsed) {
		if cookie.Name == "numdock_session" {
			saved = cookie
		}
	}
	if saved == nil {
		t.Fatal("session cookie missing")
	}
	status, _, _ = request(t, alice, "POST", f.server.URL+"/v1/auth/logout", csrfA, "", "http://client.test")
	if status != 204 {
		t.Fatal("logout failed")
	}
	replay := newClient(t)
	replay.Jar.SetCookies(parsed, []*http.Cookie{saved})
	status, _, _ = request(t, replay, "GET", f.server.URL+"/v1/me", "", "", "")
	if status != 401 {
		t.Fatal("revoked session replay accepted")
	}

	status, _, _ = request(t, alice, "POST", f.server.URL+"/v1/auth/login", csrfA, `{"email":"alice@example.com","password":"an incorrect long password"}`, "http://client.test")
	if status != 401 {
		t.Fatal("incorrect password accepted")
	}
	status, _, _ = request(t, alice, "POST", f.server.URL+"/v1/auth/login", csrfA, `{"email":"alice@example.com","password":"a sufficiently long passphrase"}`, "http://client.test")
	if status != 200 {
		t.Fatal("login failed")
	}
	// Expiry is enforced in the database, independent of browser cookie expiry.
	if _, err := f.pool.Exec(context.Background(), "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1", first.User.ID); err != nil {
		t.Fatal(err)
	}
	status, _, _ = request(t, alice, "GET", f.server.URL+"/v1/me", "", "", "")
	if status != 401 {
		t.Fatal("expired session accepted")
	}
}

func TestPersistentAuthRateLimit(t *testing.T) {
	f := setup(t)
	client := newClient(t)
	csrf := token(t, f, client)
	// Exhaust the real persisted IP bucket without performing expensive hashes.
	key := sha256.Sum256([]byte("ip:127.0.0.1"))
	if _, err := f.pool.Exec(context.Background(), "INSERT INTO auth_rate_limits (key, attempts, expires_at) VALUES ($1,20,now()+interval '1 minute')", hex.EncodeToString(key[:])); err != nil {
		t.Fatal(err)
	}
	status, _, headers := request(t, client, "POST", f.server.URL+"/v1/auth/login", csrf, `{}`, "http://client.test")
	if status != 429 || headers.Get("Retry-After") != "60" {
		t.Fatal("persisted rate limit not enforced")
	}
}
