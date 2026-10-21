package server_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"numdock/backend/internal/devseed"
	"numdock/backend/internal/operations"
	operationsruntime "numdock/backend/internal/operations/runtime"
	"numdock/backend/internal/platform/config"
	"sync"
	"testing"
)

func TestDeveloperSeedAndConcurrentResourceLimits(t *testing.T) {
	key := randomBytes(t, 32)
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development", DataEncryptionKey: key})
	seedDevelopment(t, f)
	ctx := context.Background()
	runtime, err := operationsruntime.New(f.pool, key, true, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err = devseed.Operations(ctx, runtime.Store); err != nil {
			t.Fatal(err)
		}
	}
	for _, entry := range []struct{ org, user string }{{devseed.WorkspaceID, "d1000000-0000-4000-8000-000000000001"}, {devseed.IsolatedWorkspaceID, "d1000000-0000-4000-8000-000000000004"}} {
		a := operations.Actor{OrganizationID: entry.org, UserID: entry.user}
		var balance int64
		if err = f.pool.QueryRow(ctx, "SELECT available_minor FROM wallets WHERE organization_id=$1", entry.org).Scan(&balance); err != nil {
			t.Fatal(err)
		}
		if entry.org == devseed.WorkspaceID && balance != 24325 {
			t.Fatal("seed rerun changed wallet")
		}
		keys, err := runtime.Store.Read(ctx, a, operations.Filter{View: "keys", Limit: 20})
		if err != nil {
			t.Fatal(err)
		}
		if keys.Total != 2 {
			t.Fatal("seed key count mismatch")
		}
		revoked := 0
		for _, k := range keys.APIKeys {
			if k.Revoked {
				revoked++
			}
			for _, scope := range k.Scopes {
				if scope == "numbers:write" {
					t.Fatal("seed key can write")
				}
			}
		}
		if revoked != 1 {
			t.Fatal("revoked key example missing")
		}
		hooks, err := runtime.Store.Read(ctx, a, operations.Filter{View: "webhooks", Limit: 20})
		if err != nil || hooks.Total != 3 {
			t.Fatal("webhook samples missing")
		}
		disabled := 0
		for _, h := range hooks.Webhooks {
			if !h.Enabled {
				disabled++
			}
		}
		if disabled != 1 {
			t.Fatal("disabled hook example missing")
		}
		deliveries, err := runtime.Store.Read(ctx, a, operations.Filter{View: "deliveries", Limit: 20})
		if err != nil || deliveries.Total != 2 {
			t.Fatal("idempotent sample deliveries missing")
		}
	}
	var secrets int
	if err = f.pool.QueryRow(ctx, "SELECT count(*) FROM operation_requests WHERE response ? 'secret'").Scan(&secrets); err != nil || secrets != 0 {
		t.Fatal("seed persisted one-time secrets")
	}
	owner, csrf := loginDevelopment(t, f, "owner@numdock.test")
	status, _ := operationRequest(t, f, owner, "POST", "/webhooks", "bad-sample-url", csrf, "", operations.Command{URL: "http://localhost"})
	if status != 400 {
		t.Fatal("unsafe webhook accepted")
	}
	var disabledID string
	if err = f.pool.QueryRow(ctx, "SELECT id FROM webhook_endpoints WHERE organization_id=$1 AND NOT enabled", devseed.WorkspaceID).Scan(&disabledID); err != nil {
		t.Fatal(err)
	}
	status, _ = operationRequest(t, f, owner, "POST", "/webhooks/"+disabledID+"/test", "disabled-sample-test", csrf, "", operations.Command{})
	if status != 400 {
		t.Fatal("disabled webhook test accepted")
	}
	// Fill to nine using isolated test setup; two concurrent creates must not exceed ten.
	if _, err = f.pool.Exec(ctx, "INSERT INTO webhook_endpoints(organization_id,url,secret_ciphertext,enabled) SELECT $1,'mock://success',decode('01','hex'),false FROM generate_series(1,6)", devseed.WorkspaceID); err != nil {
		t.Fatal(err)
	}
	var statuses [2]int
	var wg sync.WaitGroup
	for i := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i], _ = operationRequest(t, f, owner, "POST", "/webhooks", []string{"limit-create-one", "limit-create-two"}[i], csrf, "", operations.Command{URL: "mock://success"})
		}()
	}
	wg.Wait()
	if !((statuses[0] == 200 && statuses[1] == 400) || (statuses[0] == 400 && statuses[1] == 200)) {
		t.Fatalf("resource limit race: %v", statuses)
	}
	var count int
	if err = f.pool.QueryRow(ctx, "SELECT count(*) FROM webhook_endpoints WHERE organization_id=$1", devseed.WorkspaceID).Scan(&count); err != nil || count != 10 {
		t.Fatal("resource cap exceeded")
	}
	status, data, _ := request(t, owner, "GET", f.server.URL+"/v1/organizations/"+devseed.WorkspaceID+"/workspace?view=keys", "", "", "")
	if status != 200 {
		t.Fatal("seed keys not readable")
	}
	var snapshot operations.Snapshot
	if err = json.Unmarshal(data, &snapshot); err != nil {
		t.Fatal(err)
	}
	if snapshot.Total != 2 {
		t.Fatal("HTTP did not return seeded keys")
	}
}
