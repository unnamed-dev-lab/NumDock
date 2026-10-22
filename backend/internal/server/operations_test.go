package server_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"numdock/backend/internal/devseed"
	"numdock/backend/internal/operations"
	operationsruntime "numdock/backend/internal/operations/runtime"
	"numdock/backend/internal/platform/config"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

func operationRequest(t *testing.T, f fixture, client *http.Client, method, path, key, csrf, bearer string, body operations.Command) (int, operations.Result) {
	t.Helper()
	encoded, _ := json.Marshal(body)
	req, err := http.NewRequest(method, f.server.URL+"/v1/organizations/"+devseed.WorkspaceID+path, bytes.NewReader(encoded))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://client.test")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CSRF-Token", csrf)
	req.Header.Set("Idempotency-Key", key)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	assertContract(t, method, req.URL.Path, res.StatusCode, data)
	var out operations.Result
	if res.StatusCode == 200 {
		if err = json.Unmarshal(data, &out); err != nil {
			t.Fatal(err)
		}
	}
	return res.StatusCode, out
}
func loginDevelopment(t *testing.T, f fixture, email string) (*http.Client, string) {
	t.Helper()
	c := newClient(t)
	csrf := token(t, f, c)
	status, _, _ := request(t, c, "POST", f.server.URL+"/v1/auth/login", csrf, `{"email":"`+email+`","password":"`+developmentPassword+`"}`, "http://client.test")
	if status != 200 {
		t.Fatal("development login failed")
	}
	return c, csrf
}
func TestMockTransactionsSecurityAndInboundMessages(t *testing.T) {
	key := randomBytes(t, 32)
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development", DataEncryptionKey: key})
	seedDevelopment(t, f)
	owner, csrf := loginDevelopment(t, f, "owner@numdock.test")
	member, memberCSRF := loginDevelopment(t, f, "member@numdock.test")
	isolated, _ := loginDevelopment(t, f, "isolated@numdock.test")
	ctx := context.Background()
	var err error
	org := devseed.WorkspaceID
	must := func(path, key string, c operations.Command) operations.Result {
		t.Helper()
		status, out := operationRequest(t, f, owner, "POST", path, key, csrf, "", c)
		if status != 200 {
			t.Fatalf("%s: %d", path, status)
		}
		return out
	}
	credit := operations.Command{AmountMinor: 10000}
	p := must("/billing/payments", "credit-0001", credit)
	must("/billing/payments/"+p.ID+"/confirm", "settle-credit-0001", operations.Command{})
	must("/billing/payments/"+p.ID+"/confirm", "settle-credit-0001", operations.Command{})
	status, _ := operationRequest(t, f, owner, "POST", "/billing/payments", "credit-0001", csrf, "", operations.Command{AmountMinor: 12000})
	if status != 409 {
		t.Fatal("changed idempotency input accepted")
	}
	status, _ = operationRequest(t, f, member, "POST", "/billing/payments", "member-credit", memberCSRF, "", credit)
	if status != 403 {
		t.Fatal("member could write")
	}
	status, _ = operationRequest(t, f, owner, "POST", "/billing/payments", "no-csrf-key", "", "", credit)
	if status != 403 {
		t.Fatal("missing CSRF accepted")
	}
	purchase := operations.Command{CatalogItemID: "d2000000-0000-4000-8000-000000000001", Purpose: "customer_support", ConfirmedTerms: true, RentalDays: 30}
	var results [2]operations.Result
	var statuses [2]int
	var wg sync.WaitGroup
	for i := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses[i], results[i] = operationRequest(t, f, owner, "POST", "/orders", fmt.Sprintf("purchase-%d", i), csrf, "", purchase)
		}()
	}
	wg.Wait()
	var successful operations.Result
	successes := 0
	for i, s := range statuses {
		if s == 200 {
			successful = results[i]
			successes++
		} else if s != 409 {
			t.Fatalf("unexpected concurrent status %d", s)
		}
	}
	if successes != 1 {
		t.Fatal("exclusive lease allocation failed")
	}
	var available, reserved int64
	if err := f.pool.QueryRow(ctx, "SELECT available_minor,reserved_minor FROM wallets WHERE organization_id=$1", org).Scan(&available, &reserved); err != nil {
		t.Fatal(err)
	}
	if available != 9800 || reserved != 0 {
		t.Fatal("double credit/debit or unreleased reserve")
	}
	failed := must("/orders", "failed-order", operations.Command{CatalogItemID: "d2000000-0000-4000-8000-000000000003", Purpose: "service_testing", ConfirmedTerms: true, RentalDays: 30, SimulateFailure: true})
	if failed.Status != "failed" || failed.Wallet.AvailableMinor != 9800 {
		t.Fatal("failure did not compensate funds")
	}
	message := must("/messages/simulate", "simulate-message", operations.Command{LeaseID: successful.Number.ID, Body: "Mock customer support content"})
	var cipher []byte
	if err := f.pool.QueryRow(ctx, "SELECT payload_ciphertext FROM messages WHERE id=$1", message.ID).Scan(&cipher); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(cipher, []byte("customer support")) {
		t.Fatal("plaintext body persisted")
	}
	path := "/v1/organizations/" + org + "/messages/" + message.ID
	status, _, _ = request(t, isolated, "GET", f.server.URL+path, "", "", "")
	if status != 404 {
		t.Fatal("cross-tenant message exposed")
	}
	status, body, _ := request(t, owner, "GET", f.server.URL+path, "", "", "")
	if status != 200 || !bytes.Contains(body, []byte("Mock customer support content")) {
		t.Fatal("authorized decryption failed")
	}
	status, _ = operationRequest(t, f, owner, "POST", "/orders/"+successful.ID+"/refund", "refund-active", csrf, "", operations.Command{})
	if status != 409 {
		t.Fatal("active lease refunded")
	}
	must("/leases/"+successful.Number.ID+"/release", "release-number", operations.Command{})
	refund := must("/orders/"+successful.ID+"/refund", "refund-once", operations.Command{})
	if refund.Wallet.AvailableMinor != 10000 {
		t.Fatal("refund balance mismatch")
	}
	status, _ = operationRequest(t, f, owner, "POST", "/orders/"+successful.ID+"/refund", "refund-twice", csrf, "", operations.Command{})
	if status != 409 {
		t.Fatal("double refund allowed")
	}
	if _, err = f.pool.Exec(ctx, "UPDATE ledger_entries SET available_delta=0 WHERE organization_id=$1", org); err == nil {
		t.Fatal("ledger is mutable")
	}
	// Signed events deduplicate and late events are quarantined, never exposed to a new lease.
	incoming := operations.Incoming{ID: "provider-event-0001", LeaseID: successful.Number.ID, Body: "late mock notification", OccurredAt: time.Now()}
	send := func(in operations.Incoming, signed bool) int {
		data, _ := json.Marshal(in)
		req, _ := http.NewRequest("POST", f.server.URL+"/v1/providers/mock/webhook", bytes.NewReader(data))
		ts := strconv.FormatInt(time.Now().Unix(), 10)
		req.Header.Set("X-NumDock-Timestamp", ts)
		if signed {
			derive := hmac.New(sha256.New, key)
			derive.Write([]byte("numdock/mock-provider-webhook"))
			mac := hmac.New(sha256.New, derive.Sum(nil))
			mac.Write([]byte(ts + "."))
			mac.Write(data)
			req.Header.Set("X-NumDock-Signature", hex.EncodeToString(mac.Sum(nil)))
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		return res.StatusCode
	}
	if send(incoming, false) != 401 || send(incoming, true) != 200 || send(incoming, true) != 200 {
		t.Fatal("provider signature or duplicate handling failed")
	}
	incoming.Body = "changed body"
	if send(incoming, true) != 409 {
		t.Fatal("conflicting provider event accepted")
	}
	var state string
	if err = f.pool.QueryRow(ctx, "SELECT state FROM provider_events WHERE id=$1", incoming.ID).Scan(&state); err != nil || state != "quarantined" {
		t.Fatal("late message not quarantined")
	}
	// SSE resumes at an existing cursor and emits tenant metadata without message bodies.
	req, _ := http.NewRequest("GET", f.server.URL+"/v1/organizations/"+org+"/events/stream", nil)
	req.Header.Set("Last-Event-ID", "0")
	res, err := owner.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	chunk := make([]byte, 2048)
	n, _ := res.Body.Read(chunk)
	res.Body.Close()
	if res.StatusCode != 200 || !strings.Contains(string(chunk[:n]), "data:") || strings.Contains(string(chunk[:n]), "customer support content") {
		t.Fatal("SSE replay failed")
	}
}

func TestMockRetentionExpiryAndReplay(t *testing.T) {
	key := randomBytes(t, 32)
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development", DataEncryptionKey: key})
	seedDevelopment(t, f)
	ctx := context.Background()
	runtime, err := operationsruntime.New(f.pool, key, true, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	a := operations.Actor{UserID: "d1000000-0000-4000-8000-000000000001", OrganizationID: devseed.WorkspaceID}
	run := func(key string, c operations.Command) operations.Result {
		t.Helper()
		out, err := runtime.Store.Execute(ctx, a, key, c)
		if err != nil {
			t.Fatal(err)
		}
		return out
	}
	run("retention-credit", operations.Command{Kind: "credit", AmountMinor: 10000})
	order := run("retention-purchase", operations.Command{Kind: "purchase", CatalogItemID: "d2000000-0000-4000-8000-000000000001", Purpose: "service_testing", ConfirmedTerms: true, RentalDays: 30})
	incoming := operations.Incoming{ID: "valid-provider-message", LeaseID: order.Number.ID, Body: "retained mock text", OccurredAt: time.Now()}
	state, err := runtime.Store.Ingest(ctx, incoming)
	if err != nil || state != "accepted" {
		t.Fatal("valid message rejected")
	}
	state, err = runtime.Store.Ingest(ctx, incoming)
	if err != nil || state != "duplicate" {
		t.Fatal("duplicate message repeated")
	}
	var count int
	if err = f.pool.QueryRow(ctx, "SELECT count(*) FROM messages WHERE provider_event_id=$1", incoming.ID).Scan(&count); err != nil || count != 1 {
		t.Fatal("provider duplicate created another message")
	}
	events, err := runtime.Store.Events(ctx, a, 0)
	if err != nil || len(events) == 0 {
		t.Fatal("missing events")
	}
	last := events[len(events)-1].ID
	events, err = runtime.Store.Events(ctx, a, last)
	if err != nil || len(events) != 0 {
		t.Fatal("cursor replay returned old events")
	}
	run("replay-new-credit", operations.Command{Kind: "credit", AmountMinor: 100})
	events, err = runtime.Store.Events(ctx, a, last)
	if err != nil || len(events) != 1 || events[0].ID <= last {
		t.Fatal("cursor recovery lost new event")
	}
	_, err = runtime.Store.Events(ctx, operations.Actor{UserID: "d1000000-0000-4000-8000-000000000004", OrganizationID: devseed.WorkspaceID}, 0)
	if err == nil {
		t.Fatal("cross-tenant events exposed")
	}
	if _, err = f.pool.Exec(ctx, "UPDATE messages SET expires_at=now()-interval '1 second' WHERE id=$1", incoming.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = runtime.Store.Message(ctx, a, incoming.ID); err == nil {
		t.Fatal("expired message readable")
	}
	if err = runtime.Store.RunTask(ctx, "purge_message", incoming.ID); err != nil {
		t.Fatal(err)
	}
	var erased bool
	if err = f.pool.QueryRow(ctx, "SELECT payload_ciphertext IS NULL FROM provider_events WHERE id=$1", incoming.ID).Scan(&erased); err != nil || !erased {
		t.Fatal("retention did not erase raw payload")
	}
	if _, err = f.pool.Exec(ctx, "UPDATE leases SET started_at=now()-interval '31 days',expires_at=now()-interval '1 second' WHERE id=$1", order.Number.ID); err != nil {
		t.Fatal(err)
	}
	if err = runtime.Store.RunTask(ctx, "expire_lease", order.Number.ID); err != nil {
		t.Fatal(err)
	}
	if err = runtime.Store.RunTask(ctx, "expire_lease", order.Number.ID); err != nil {
		t.Fatal("expiry not idempotent")
	}
	if err = f.pool.QueryRow(ctx, "SELECT status FROM catalog_items WHERE id=$1", "d2000000-0000-4000-8000-000000000001").Scan(&state); err != nil || state != "quarantined" {
		t.Fatal("expired number not quarantined")
	}
}
