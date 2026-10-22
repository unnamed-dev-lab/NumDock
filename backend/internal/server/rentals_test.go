package server_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"numdock/backend/internal/catalog"
	"numdock/backend/internal/devseed"
	"numdock/backend/internal/operations"
	"numdock/backend/internal/platform/config"
	"strings"
	"testing"
	"time"
)

func TestRentalPeriodsPricingPersistenceAndValidation(t *testing.T) {
	f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: "development", DataEncryptionKey: randomBytes(t, 32)})
	seedDevelopment(t, f)
	client, csrf := loginDevelopment(t, f, "owner@numdock.test")
	run := func(path, key string, c operations.Command) operations.Result {
		t.Helper()
		status, result := operationRequest(t, f, client, "POST", path, key, csrf, "", c)
		if status != 200 {
			t.Fatalf("%s: %d", path, status)
		}
		return result
	}
	payment := run("/billing/payments", "rental-funds", operations.Command{AmountMinor: 10000})
	run("/billing/payments/"+payment.ID+"/confirm", "rental-fund-pay", operations.Command{})
	status, data, _ := request(t, client, "GET", f.server.URL+"/v1/catalog/numbers?limit=100", "", "", "")
	if status != 200 {
		t.Fatal(status)
	}
	var inventory catalog.List
	if err := json.Unmarshal(data, &inventory); err != nil {
		t.Fatal(err)
	}
	for i, days := range []int32{3, 7, 30} {
		item := inventory.Items[i]
		var quoted int64 = -1
		for _, option := range item.RentalOptions {
			if option.Days == days {
				quoted = option.AmountMinor
			}
		}
		if quoted < 0 {
			t.Fatal("missing rental quote")
		}
		command := operations.Command{CatalogItemID: item.ID, Purpose: "customer_support", ConfirmedTerms: true, RentalDays: days}
		key := fmt.Sprintf("rental-%d-days", days)
		result := run("/orders", key, command)
		if result.Order == nil || result.Number == nil || result.Order.RentalDays != days || result.Number.RentalDays != days || result.Order.AmountMinor != quoted || result.Number.AmountMinor != quoted || result.Wallet.AvailableMinor != 10000-quoted {
			t.Fatalf("wrong term or charge: %+v", result)
		}
		duration := result.Number.ExpiresAt.Sub(result.Number.StartedAt)
		if delta := duration - time.Duration(days)*24*time.Hour; delta < -time.Second || delta > time.Second {
			t.Fatal("incorrect lease expiry", duration)
		}
		replay := run("/orders", key, command)
		if replay.ID != result.ID || replay.Wallet.AvailableMinor != result.Wallet.AvailableMinor {
			t.Fatal("rental replay charged twice")
		}
		changed := command
		changed.RentalDays = 7
		if days == 7 {
			changed.RentalDays = 3
		}
		if status, _ := operationRequest(t, f, client, "POST", "/orders", key, csrf, "", changed); status != 409 {
			t.Fatal("changed rental period reused a successful key", status)
		}
		var storedDays int32
		var storedAmount int64
		var scheduled time.Time
		if err := f.pool.QueryRow(context.Background(), "SELECT rental_days,amount_minor FROM orders WHERE id=$1", result.ID).Scan(&storedDays, &storedAmount); err != nil {
			t.Fatal(err)
		}
		if storedDays != days || storedAmount != quoted {
			t.Fatal("rental snapshot not persisted")
		}
		if err := f.pool.QueryRow(context.Background(), "SELECT scheduled_at FROM river_job WHERE args->>'task'='expire_lease' AND args->>'id'=$1", result.Number.ID).Scan(&scheduled); err != nil {
			t.Fatal(err)
		}
		if !scheduled.Equal(result.Number.ExpiresAt) {
			t.Fatal("expiry job does not match selected term")
		}
		run("/leases/"+result.Number.ID+"/release", key+"-release", operations.Command{})
		refunded := run("/orders/"+result.ID+"/refund", key+"-refund", operations.Command{})
		if refunded.Wallet.AvailableMinor != 10000 {
			t.Fatal("refund did not return exact short-term charge")
		}
	}
	for _, tt := range []struct{ body, code string }{
		{`{"catalog_item_id":"unused","purpose":"customer_support","confirmed_terms":true}`, "invalid_rental_period"},
		{`{"catalog_item_id":"unused","purpose":"customer_support","confirmed_terms":true,"rental_days":5}`, "invalid_rental_period"},
		{`{"catalog_item_id":"unused","purpose":"customer_support","confirmed_terms":false,"rental_days":3}`, "terms_required"},
	} {
		req, _ := http.NewRequest("POST", f.server.URL+"/v1/organizations/"+devseed.WorkspaceID+"/orders", strings.NewReader(tt.body))
		req.Header.Set("Origin", "http://client.test")
		req.Header.Set("X-CSRF-Token", csrf)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", "validation-"+tt.code)
		response, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var body struct {
			Code string `json:"code"`
		}
		err = json.NewDecoder(response.Body).Decode(&body)
		response.Body.Close()
		if err != nil || response.StatusCode != 400 || body.Code != tt.code {
			t.Fatalf("wrong validation: %d %s %v", response.StatusCode, body.Code, err)
		}
	}
}
