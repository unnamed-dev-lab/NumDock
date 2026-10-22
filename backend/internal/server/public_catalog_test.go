package server_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"numdock/backend/internal/catalog"
	identityhttp "numdock/backend/internal/identity/httpapi"
	"numdock/backend/internal/platform/config"
)

func TestPublicCatalogDoesNotExposePrivateInventory(t *testing.T) {
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development"})
	seedDevelopment(t, f)
	if _, err := f.pool.Exec(context.Background(), "UPDATE catalog_items SET status = CASE WHEN e164 = '+14155550100' THEN 'allocated' ELSE 'quarantined' END WHERE e164 IN ('+14155550100', '+14155550101')"); err != nil {
		t.Fatal(err)
	}
	anonymous := newClient(t)
	status, body, _ := request(t, anonymous, "GET", f.server.URL+"/v1/catalog/numbers?limit=100", "", "", "")
	var list catalog.List
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatal(err)
	}
	if status != 200 || list.Total != 22 {
		t.Fatal("public available inventory is incorrect")
	}
	for _, private := range []string{"+14155550100", "+14155550101", "owner@numdock.test", "organization_id", "password_hash", "message_body"} {
		if strings.Contains(string(body), private) {
			t.Fatalf("public catalog exposed private field %s", private)
		}
	}
	status, _, _ = request(t, anonymous, "GET", f.server.URL+"/v1/organizations/d0000000-0000-4000-8000-000000000001/numbers", "", "", "")
	if status != 401 {
		t.Fatal("private workspace allowed anonymous access")
	}
	status, _, _ = request(t, anonymous, "POST", f.server.URL+"/v1/organizations/d0000000-0000-4000-8000-000000000001/orders", "", "{}", "http://client.test")
	if status != 401 {
		t.Fatal("anonymous catalog access enabled purchasing")
	}
}

func TestOrganizationSlugUniqueAndStable(t *testing.T) {
	f := setup(t)
	a, b := newClient(t), newClient(t)
	first := register(t, f, a, token(t, f, a), "slug-a@example.com", "Same Company")
	second := register(t, f, b, token(t, f, b), "slug-b@example.com", "Same Company")
	slug := first.Organizations[0].Slug
	if !strings.HasPrefix(slug, "same-company-") || slug == second.Organizations[0].Slug {
		t.Fatal("duplicate names did not get separate readable URLs")
	}
	if _, err := f.pool.Exec(context.Background(), "UPDATE organizations SET name='Renamed Company' WHERE id=$1", first.Organizations[0].ID); err != nil {
		t.Fatal(err)
	}
	status, body, _ := request(t, a, "GET", f.server.URL+"/v1/me", "", "", "")
	var current identityhttp.Identity
	if err := json.Unmarshal(body, &current); err != nil {
		t.Fatal(err)
	}
	if status != 200 || current.Organizations[0].Slug != slug {
		t.Fatal("renaming broke the stable workspace URL")
	}
}
