package server_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"

	"numdock/backend/internal/operations"
	opspostgres "numdock/backend/internal/operations/postgres"
	"numdock/backend/internal/platform/config"
)

func TestPaymentLifecycleAndIsolation(t *testing.T) {
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development"})
	a, b := newClient(t), newClient(t)
	csrfA, csrfB := token(t, f, a), token(t, f, b)
	first := register(t, f, a, csrfA, "pay-a@example.com", "Pay Account")
	second := register(t, f, b, csrfB, "pay-b@example.com", "Other Account")
	org := first.Organizations[0].ID
	path := f.server.URL + "/v1/organizations/" + org
	post := func(suffix, key, body string) operations.Result {
		t.Helper()
		// request() omits Idempotency-Key, so use the shared mutation helper's pattern.
		req, err := http.NewRequest("POST", path+suffix, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://client.test")
		req.Header.Set("X-CSRF-Token", csrfA)
		req.Header.Set("Idempotency-Key", key)
		res, err := a.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		raw, err := io.ReadAll(res.Body)
		if err != nil {
			t.Fatal(err)
		}
		assertContract(t, "POST", req.URL.Path, res.StatusCode, raw)
		if res.StatusCode != 200 {
			t.Fatalf("payment %s: %d %s", suffix, res.StatusCode, raw)
		}
		var out operations.Result
		if err = json.Unmarshal(raw, &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	read := func() operations.Snapshot {
		t.Helper()
		status, raw, _ := request(t, a, "GET", path+"/summary", "", "", "")
		var out operations.Snapshot
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatal(err)
		}
		if status != 200 {
			t.Fatal("payment list unavailable")
		}
		return out
	}
	create := post("/billing/payments", "create-order-001", `{"amount_minor":2500}`)
	if create.Payment == nil || create.Status != "pending" || read().Wallet.AvailableMinor != 0 {
		t.Fatal("creating payment prematurely credited balance")
	}
	replay := post("/billing/payments", "create-order-001", `{"amount_minor":2500}`)
	if replay.ID != create.ID {
		t.Fatal("create replay made duplicate orders")
	}
	result := post("/billing/payments/"+create.ID+"/confirm", "confirm-order-001", `{"amount_minor":999999}`)
	if result.Status != "succeeded" || result.Wallet.AvailableMinor != 2500 {
		t.Fatal("payment did not settle the stored amount")
	}
	post("/billing/payments/"+create.ID+"/confirm", "confirm-order-001", `{"amount_minor":999999}`)
	post("/billing/payments/"+create.ID+"/confirm", "confirm-order-002", `{}`)
	post("/billing/payments/"+create.ID+"/cancel", "cancel-paid-order", `{}`)
	if read().Wallet.AvailableMinor != 2500 {
		t.Fatal("terminal payment credited twice")
	}
	canceled := post("/billing/payments", "create-order-002", `{"amount_minor":1000}`)
	if post("/billing/payments/"+canceled.ID+"/cancel", "cancel-order-002", `{}`).Status != "canceled" {
		t.Fatal("cancel failed")
	}
	if post("/billing/payments/"+canceled.ID+"/confirm", "confirm-canceled", `{}`).Status != "canceled" {
		t.Fatal("canceled payment was revived")
	}
	failed := post("/billing/payments", "create-order-003", `{"amount_minor":1000}`)
	if post("/billing/payments/"+failed.ID+"/confirm", "confirm-order-003", `{"simulate_failure":true}`).Status != "failed" {
		t.Fatal("failure path missing")
	}
	expired := post("/billing/payments", "create-order-004", `{"amount_minor":1000}`)
	if _, err := f.pool.Exec(context.Background(), "UPDATE payment_orders SET created_at=now()-interval '20 minutes',expires_at=now()-interval '1 minute' WHERE id=$1", expired.ID); err != nil {
		t.Fatal(err)
	}
	if post("/billing/payments/"+expired.ID+"/confirm", "confirm-order-004", `{}`).Status != "expired" {
		t.Fatal("expired payment credited")
	}
	if read().Wallet.AvailableMinor != 2500 {
		t.Fatal("failed/canceled/expired payment changed balance")
	}
	// Cross-account confirmation uses the attacker's valid session and CSRF.
	req, _ := http.NewRequest("POST", f.server.URL+"/v1/organizations/"+second.Organizations[0].ID+"/billing/payments/"+create.ID+"/confirm", strings.NewReader(`{}`))
	req.Header.Set("Origin", "http://client.test")
	req.Header.Set("X-CSRF-Token", csrfB)
	req.Header.Set("Idempotency-Key", "cross-account-confirm")
	res, err := b.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatal("payment escaped account isolation")
	}
	// Exercise the durable expiration worker twice; retries must not change funds.
	timed := post("/billing/payments", "worker-expiry-order", `{"amount_minor":1000}`)
	if _, err := f.pool.Exec(context.Background(), "UPDATE payment_orders SET created_at=now()-interval '20 minutes',expires_at=now()-interval '1 minute' WHERE id=$1", timed.ID); err != nil {
		t.Fatal(err)
	}
	worker, err := opspostgres.New(f.pool, make([]byte, 32), true)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err = worker.RunTask(context.Background(), "expire_payment", timed.ID); err != nil {
			t.Fatal(err)
		}
	}
	if post("/billing/payments/"+timed.ID+"/confirm", "confirm-after-expiry", "{}").Status != "expired" {
		t.Fatal("worker did not close expired payment")
	}
	// Distinct concurrent confirmation keys still settle exactly once.
	concurrent := post("/billing/payments", "create-concurrent", `{"amount_minor":500}`)
	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			post("/billing/payments/"+concurrent.ID+"/confirm", fmt.Sprintf("concurrent-pay-%d", i), `{}`)
		}(i)
	}
	wg.Wait()
	if read().Wallet.AvailableMinor != 3000 {
		t.Fatal("concurrent confirmation double credited")
	}
	var count int
	if err := f.pool.QueryRow(context.Background(), "SELECT count(*) FROM ledger_entries WHERE reference_id=$1 AND kind='payment_credit'", concurrent.ID).Scan(&count); err != nil || count != 1 {
		t.Fatal("payment must have exactly one immutable credit")
	}
	// The scheduled worker is durable and guarded, not an in-process timer.
	var scheduled int
	if err := f.pool.QueryRow(context.Background(), "SELECT count(*) FROM river_job WHERE args->>'task'='expire_payment'").Scan(&scheduled); err != nil || scheduled < 5 {
		t.Fatal("payment expiration was not durably scheduled")
	}
}
