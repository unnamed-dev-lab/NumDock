package server_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"numdock/backend/internal/catalog"
	"numdock/backend/internal/devseed"
	identityhttp "numdock/backend/internal/identity/httpapi"
	"numdock/backend/internal/platform/config"
	"numdock/backend/internal/server"
)

const developmentPassword = "development test passphrase"

func seedDevelopment(t *testing.T, f fixture) {
	t.Helper()
	if err := devseed.Run(context.Background(), f.pool, "development", developmentPassword); err != nil {
		t.Fatal(err)
	}
}

func TestDevelopmentSeedAndCatalog(t *testing.T) {
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development"})
	ctx := context.Background()
	seedDevelopment(t, f)
	var originalHash string
	if err := f.pool.QueryRow(ctx, "SELECT password_hash FROM users WHERE email = 'owner@numdock.test'").Scan(&originalHash); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(originalHash, "$argon2id$") || strings.Contains(originalHash, developmentPassword) {
		t.Fatal("seed did not hash password")
	}
	if err := devseed.Run(ctx, f.pool, "development", "a different seed password"); err != nil {
		t.Fatal(err)
	}
	var userCount, orgCount, itemCount, sessionCount int
	var rerunHash string
	if err := f.pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM organizations), (SELECT count(*) FROM catalog_items), (SELECT count(*) FROM sessions), (SELECT password_hash FROM users WHERE email = 'owner@numdock.test')").Scan(&userCount, &orgCount, &itemCount, &sessionCount, &rerunHash); err != nil {
		t.Fatal(err)
	}
	if userCount != 4 || orgCount != 2 || itemCount != 24 || sessionCount != 0 || originalHash != rerunHash {
		t.Fatal("seed rerun changed accounts, sessions, or fixture counts")
	}
	if _, err := f.pool.Exec(ctx, "UPDATE catalog_items SET use_cases=ARRAY['other'] WHERE id='d2000000-0000-4000-8000-000000000001'"); err != nil {
		t.Fatal(err)
	}
	if err := devseed.Run(ctx, f.pool, "development", "a different seed password"); err != nil {
		t.Fatal(err)
	}
	var rerunUseCases []string
	if err := f.pool.QueryRow(ctx, "SELECT use_cases FROM catalog_items WHERE id='d2000000-0000-4000-8000-000000000001'").Scan(&rerunUseCases); err != nil {
		t.Fatal(err)
	}
	if len(rerunUseCases) != 3 || !slices.Contains(rerunUseCases, "openai") {
		t.Fatal("seed rerun did not restore catalog use cases")
	}
	var missingUseCases int
	if err := f.pool.QueryRow(ctx, "SELECT count(*) FROM catalog_items WHERE cardinality(use_cases)=0").Scan(&missingUseCases); err != nil {
		t.Fatal(err)
	}
	if missingUseCases != 0 {
		t.Fatal("catalog fixtures must have use cases")
	}
	if _, err := f.pool.Exec(ctx, "UPDATE catalog_items SET use_cases=ARRAY['not-a-service'] WHERE id='d2000000-0000-4000-8000-000000000001'"); err == nil {
		t.Fatal("catalog accepted an invalid use case")
	}
	if _, err := f.pool.Exec(ctx, "UPDATE catalog_items SET use_cases='{}' WHERE id='d2000000-0000-4000-8000-000000000001'"); err == nil {
		t.Fatal("catalog accepted empty use cases")
	}
	client := newClient(t)
	status, _, _ := request(t, client, "GET", f.server.URL+"/v1/catalog/numbers", "", "", "")
	if status != 200 {
		t.Fatal("public catalog rejected anonymous browsing")
	}
	csrf := token(t, f, client)
	for _, a := range []struct{ email, role, organization string }{
		{"owner@numdock.test", "owner", devseed.WorkspaceID},
		{"admin@numdock.test", "admin", devseed.WorkspaceID},
		{"member@numdock.test", "member", devseed.WorkspaceID},
		{"isolated@numdock.test", "owner", devseed.IsolatedWorkspaceID},
	} {
		status, body, _ := request(t, client, "POST", f.server.URL+"/v1/auth/login", csrf, `{"email":"`+a.email+`","password":"`+developmentPassword+`"}`, "http://client.test")
		if status != 200 {
			t.Fatalf("seed account login failed: %d %s", status, body)
		}
		var current identityhttp.Identity
		if err := json.Unmarshal(body, &current); err != nil {
			t.Fatal(err)
		}
		if len(current.Organizations) != 1 || current.Organizations[0].ID != a.organization || current.Organizations[0].Role != a.role {
			t.Fatal("seed membership isolation failed")
		}
		status, body, _ = request(t, client, "GET", f.server.URL+"/v1/organizations", "", "", "")
		var organizations struct {
			Items []identityhttp.Organization `json:"items"`
		}
		if err := json.Unmarshal(body, &organizations); err != nil {
			t.Fatal(err)
		}
		if status != 200 || len(organizations.Items) != 1 || organizations.Items[0].ID != a.organization {
			t.Fatal("organization list crossed tenant boundaries")
		}
	}
	get := func(query string) catalog.List {
		t.Helper()
		status, body, _ := request(t, client, "GET", f.server.URL+"/v1/catalog/numbers"+query, "", "", "")
		if status != 200 {
			t.Fatalf("catalog failed: %d %s", status, body)
		}
		var result catalog.List
		if err := json.Unmarshal(body, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	first, second := get("?limit=10"), get("?limit=10&offset=10")
	if first.Total != 24 || first.Mode != "mock" || len(first.Items) != 10 || len(second.Items) != 10 {
		t.Fatal("incorrect pagination")
	}
	seen := map[string]bool{}
	for _, item := range first.Items {
		seen[item.ID] = true
		if item.Source != "mock" || item.Provider != "NumDock Mock" {
			t.Fatal("unmarked fixture")
		}
		if len(item.UseCases) == 0 {
			t.Fatal("fixture missing use cases")
		}
	}
	for _, item := range second.Items {
		if seen[item.ID] {
			t.Fatal("pagination overlap")
		}
	}
	filtered := get("?country=CA&number_type=mobile&capability=mms&sort=monthly_fee_minor&order=desc")
	if filtered.Total != 4 || len(filtered.Items) != 4 {
		t.Fatal("combined filter incorrect")
	}
	for i, item := range filtered.Items {
		if item.CountryCode != "CA" || item.NumberType != "mobile" {
			t.Fatal("incorrect filter result")
		}
		if i > 0 && filtered.Items[i-1].MonthlyFeeMinor < item.MonthlyFeeMinor {
			t.Fatal("price sort incorrect")
		}
	}
	if result := get("?q=TORONTO"); result.Total != 12 {
		t.Fatal("case insensitive search failed")
	}
	openai := get("?use_case=openai")
	if openai.Total == 0 || len(openai.Items) == 0 {
		t.Fatal("use case filter returned no inventory")
	}
	for _, item := range openai.Items {
		if !slices.Contains(item.UseCases, "openai") {
			t.Fatal("use case filter returned mismatched inventory")
		}
	}
	if result := get("?q=openai"); result.Total != openai.Total {
		t.Fatal("use case search failed")
	}
	for _, useCase := range catalog.UseCaseValues {
		if result := get("?use_case=" + useCase); result.Total == 0 {
			t.Fatalf("seed has no inventory for use case %q", useCase)
		}
	}
	for _, query := range []string{"?q=%25", "?offset=1000", "?country=ZZ"} {
		if result := get(query); len(result.Items) != 0 {
			t.Fatalf("expected empty result: %s", query)
		}
	}
	for _, query := range []string{"?limit=0", "?limit=101", "?limit=", "?offset=-1", "?offset=2147483648", "?sort=password_hash", "?order=sideways", "?country=", "?number_type=", "?capability=", "?use_case=", "?use_case=not-a-service", "?use_case=openai&use_case=google", "?country=us", "?country=USA", "?number_type=invalid", "?capability=auth_google", "?limit=10&limit=20", "?organization_id=other", "?q=" + strings.Repeat("x", 101)} {
		status, _, _ := request(t, client, "GET", f.server.URL+"/v1/catalog/numbers"+query, "", "", "")
		if status != 400 {
			t.Fatalf("invalid query accepted: %s (%d)", query, status)
		}
	}
	// A production server connected to the seeded database must hide mock stock.
	handler, err := server.New(f.pool, config.Config{AppOrigin: "http://client.test", Environment: "production"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	production := httptest.NewServer(handler)
	defer production.Close()
	status, body, _ := request(t, client, "GET", production.URL+"/v1/catalog/numbers", "", "", "")
	var result catalog.List
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	if status != 200 || result.Mode != "disabled" || result.Total != 0 || len(result.Items) != 0 {
		t.Fatal("production exposed mock inventory")
	}
}

func TestSeedRejectsProductionAndRollsBackConflict(t *testing.T) {
	// Must reject before touching any database, even if a pool is unavailable.
	if err := devseed.Run(context.Background(), nil, "production", developmentPassword); err == nil {
		t.Fatal("production seed accepted")
	}
	if err := devseed.Run(context.Background(), nil, "development", "short"); err == nil {
		t.Fatal("weak seed password accepted")
	}
	f := setup(t)
	ctx := context.Background()
	if _, err := f.pool.Exec(ctx, "INSERT INTO users (email, name, password_hash) VALUES ('owner@numdock.test', 'Existing user', 'existing hash')"); err != nil {
		t.Fatal(err)
	}
	if err := devseed.Run(ctx, f.pool, "development", developmentPassword); err == nil {
		t.Fatal("seed took over existing account")
	}
	var orgs, users, items int
	if err := f.pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM organizations), (SELECT count(*) FROM users), (SELECT count(*) FROM catalog_items)").Scan(&orgs, &users, &items); err != nil {
		t.Fatal(err)
	}
	if orgs != 0 || users != 1 || items != 0 {
		t.Fatal("seed conflict left partial data")
	}
}

func TestConcurrentDevelopmentSeed(t *testing.T) {
	f := setup(t)
	results := make(chan error, 2)
	for range 2 {
		go func() { results <- devseed.Run(context.Background(), f.pool, "development", developmentPassword) }()
	}
	for range 2 {
		if err := <-results; err != nil {
			t.Fatal(err)
		}
	}
	var users, items int
	if err := f.pool.QueryRow(context.Background(), "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM catalog_items)").Scan(&users, &items); err != nil {
		t.Fatal(err)
	}
	if users != 4 || items != 24 {
		t.Fatal("concurrent seed duplicated fixtures")
	}
}
