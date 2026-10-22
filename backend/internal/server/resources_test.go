package server_test

import (
	"encoding/json"
	"net/http"
	"numdock/backend/internal/devseed"
	"numdock/backend/internal/platform/config"
	"testing"
)

func TestResourceEndpointsAreSeparatedAndAuthorized(t *testing.T) {
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development"})
	seedDevelopment(t, f)
	owner, _ := loginDevelopment(t, f, "owner@numdock.test")
	base := f.server.URL + "/v1/organizations/" + devseed.WorkspaceID
	for _, path := range []string{"/numbers", "/messages", "/orders", "/billing/ledger", "/billing/payments"} {
		status, body, _ := request(t, owner, "GET", base+path+"?limit=1", "", "", "")
		var list map[string]json.RawMessage
		if err := json.Unmarshal(body, &list); err != nil {
			t.Fatal(err)
		}
		if status != 200 || list["items"] == nil || list["total"] == nil || len(list) != 5 {
			t.Fatalf("resource %s leaked unrelated state: %d %s", path, status, body)
		}
		status, _, _ = request(t, newClient(t), "GET", base+path, "", "", "")
		if status != 401 {
			t.Fatalf("anonymous resource access: %s", path)
		}
		status, _, _ = request(t, owner, "GET", base+path+"?view=messages", "", "", "")
		if status != 400 {
			t.Fatalf("resource accepted a view selector: %s", path)
		}
		status, _, _ = request(t, owner, "GET", base+path+"?limit=1&limit=2", "", "", "")
		if status != 400 {
			t.Fatalf("repeated pagination accepted: %s", path)
		}
	}
	status, body, _ := request(t, owner, "GET", base+"/summary", "", "", "")
	var summary map[string]json.RawMessage
	if err := json.Unmarshal(body, &summary); err != nil {
		t.Fatal(err)
	}
	if status != 200 || len(summary) != 4 || summary["wallet"] == nil || summary["numbers"] != nil {
		t.Fatal("summary leaked resource records")
	}
	isolated, _ := loginDevelopment(t, f, "isolated@numdock.test")
	for _, path := range []string{"/summary", "/numbers", "/messages", "/orders", "/billing/wallet", "/billing/ledger", "/billing/payments"} {
		status, _, _ = request(t, isolated, "GET", base+path, "", "", "")
		if status != 404 {
			t.Fatalf("cross-account read: %s", path)
		}
	}
	for _, path := range []string{"/workspace?view=numbers", "/api-keys", "/webhooks"} {
		req, _ := http.NewRequest("GET", base+path, nil)
		response, err := owner.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != 404 {
			t.Fatalf("obsolete endpoint still exposed: %s", path)
		}
	}
	// A Bearer credential cannot bypass the cookie boundary after developer keys are removed.
	req, _ := http.NewRequest("GET", base+"/numbers", nil)
	req.Header.Set("Authorization", "Bearer obsolete-development-key")
	response, err := owner.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 401 {
		t.Fatal("obsolete bearer credential was accepted")
	}
}
