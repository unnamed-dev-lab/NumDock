package server_test

import (
	"encoding/json"
	"net/http"
	"numdock/backend/internal/platform/config"
	"strings"
	"testing"
	"time"
)

func TestPublicStatusModesAndReadiness(t *testing.T) {
	for _, environment := range []string{"development", "production"} {
		t.Run(environment, func(t *testing.T) {
			f := setupWithConfig(t, config.Config{AppOrigin: "http://client.test", Environment: environment})
			for _, ready := range []bool{true, false} {
				if !ready {
					f.pool.Close()
				}
				status, body, _ := request(t, http.DefaultClient, "GET", f.server.URL+"/v1/status", "", "", "")
				if status != http.StatusOK {
					t.Fatalf("public status: %d %s", status, body)
				}
				var result struct {
					CheckedAt    time.Time         `json:"checked_at"`
					API          bool              `json:"api"`
					Database     bool              `json:"database"`
					Features     map[string]string `json:"features"`
					LiveProvider bool              `json:"live_provider_connected"`
					Payments     bool              `json:"payments_connected"`
				}
				if err := json.Unmarshal(body, &result); err != nil {
					t.Fatal(err)
				}
				if !result.API || result.Database != ready || result.CheckedAt.IsZero() || result.LiveProvider || result.Payments {
					t.Fatalf("incorrect public readiness: %s", body)
				}
				mode := "disabled"
				if environment == "development" {
					mode = "mock"
					if !ready {
						mode = "unavailable"
					}
				}
				for _, feature := range []string{"catalog", "numbers", "messaging", "billing", "developer"} {
					if result.Features[feature] != mode {
						t.Fatalf("incorrect %s mode: %s", feature, body)
					}
				}
				identityMode := "active"
				if !ready {
					identityMode = "unavailable"
				}
				if result.Features["identity"] != identityMode {
					t.Fatalf("identity mode: %s", body)
				}
				for _, forbidden := range []string{"organization_id", "email", "token", "postgres://", "password", "pool closed"} {
					if strings.Contains(string(body), forbidden) {
						t.Fatalf("private diagnostic in public status: %s", forbidden)
					}
				}
			}
		})
	}
}
