package server_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"numdock/backend/internal/devseed"
	"numdock/backend/internal/overview"
	"numdock/backend/internal/platform/config"
	"numdock/backend/internal/server"
	"testing"
	"time"
)

func TestOverviewIsOrganizationScopedAndDevelopmentOnly(t *testing.T) {
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development"})
	seedDevelopment(t, f)
	client := newClient(t)
	endpoint := f.server.URL + "/v1/organizations/" + devseed.WorkspaceID + "/overview"
	status, _, _ := request(t, client, "GET", endpoint, "", "", "")
	if status != 401 {
		t.Fatal("anonymous overview allowed")
	}
	csrf := token(t, f, client)
	status, _, _ = request(t, client, "POST", f.server.URL+"/v1/auth/login", csrf, `{"email":"owner@numdock.test","password":"`+developmentPassword+`"}`, "http://client.test")
	if status != 200 {
		t.Fatal("login failed")
	}
	var all overview.Summary
	for _, days := range []string{"7", "30"} {
		status, body, _ := request(t, client, "GET", endpoint+"?days="+days, "", "", "")
		if status != 200 {
			t.Fatalf("overview failed: %s", body)
		}
		var summary overview.Summary
		if err := json.Unmarshal(body, &summary); err != nil {
			t.Fatal(err)
		}
		if summary.Mode != "mock" || summary.SeededAt == nil || len(summary.Series) != summary.Days || summary.OrganizationID != devseed.WorkspaceID {
			t.Fatal("incorrect overview scope")
		}
		var messages, spend int64
		for _, d := range summary.Series {
			messages += d.MessagesReceived
			spend += d.SpendMinor
		}
		if summary.Totals.MessagesReceived != messages || summary.Totals.SpendMinor != spend || summary.Totals.ActiveNumbers != summary.Series[len(summary.Series)-1].ActiveNumbers {
			t.Fatal("overview aggregation incorrect")
		}
		if days == "30" {
			all = summary
		}
	}
	for _, suffix := range []string{"?days=0", "?days=8", "?days=7&days=30", "?country=US", "?days="} {
		status, _, _ := request(t, client, "GET", endpoint+suffix, "", "", "")
		if status != 400 {
			t.Fatal("invalid overview query accepted")
		}
	}
	status, _, _ = request(t, client, "GET", f.server.URL+"/v1/organizations/"+devseed.IsolatedWorkspaceID+"/overview", "", "", "")
	if status != 404 {
		t.Fatal("cross-tenant overview allowed")
	}
	// Missing days are zero-filled without merging neighboring organizations.
	missing := all.Series[3]
	if _, err := f.pool.Exec(context.Background(), "DELETE FROM development_overview_daily WHERE organization_id=$1 AND day=$2::date", devseed.WorkspaceID, missing.Date); err != nil {
		t.Fatal(err)
	}
	status, body, _ := request(t, client, "GET", endpoint, "", "", "")
	if err := json.Unmarshal(body, &all); err != nil {
		t.Fatal(err)
	}
	if status != 200 || len(all.Series) != 30 || all.Series[3].MessagesReceived != 0 {
		t.Fatal("missing day not zero-filled")
	}
	// Reruns restore only missing dates and keep edited fixtures and user passwords.
	if _, err := f.pool.Exec(context.Background(), "UPDATE development_overview_daily SET messages_received=9999 WHERE organization_id=$1 AND day=$2::date", devseed.WorkspaceID, time.Now().UTC().Format(time.DateOnly)); err != nil {
		t.Fatal(err)
	}
	seedDevelopment(t, f)
	status, body, _ = request(t, client, "GET", endpoint, "", "", "")
	if err := json.Unmarshal(body, &all); err != nil {
		t.Fatal(err)
	}
	if all.Series[len(all.Series)-1].MessagesReceived != 9999 || all.Series[3].MessagesReceived == 0 {
		t.Fatal("seed overwrote edited overview data or did not restore missing day")
	}
	router, err := server.New(f.pool, config.Config{AppOrigin: "http://client.test", Environment: "production"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	production := httptest.NewServer(router)
	defer production.Close()
	status, body, _ = request(t, client, "GET", production.URL+"/v1/organizations/"+devseed.WorkspaceID+"/overview", "", "", "")
	if err := json.Unmarshal(body, &all); err != nil {
		t.Fatal(err)
	}
	if status != 200 || all.Mode != "disabled" || len(all.Series) != 0 || all.Totals.MessagesReceived != 0 || all.SeededAt != nil {
		t.Fatal("production exposed demo overview")
	}
}
