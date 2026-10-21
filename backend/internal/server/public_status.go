package server

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"numdock/backend/internal/platform/httpx"
)

type featureMode string

const (
	featureActive      featureMode = "active"
	featureMock        featureMode = "mock"
	featureDisabled    featureMode = "disabled"
	featureUnavailable featureMode = "unavailable"
)

type publicFeatures struct {
	Identity  featureMode `json:"identity"`
	Catalog   featureMode `json:"catalog"`
	Numbers   featureMode `json:"numbers"`
	Messaging featureMode `json:"messaging"`
	Billing   featureMode `json:"billing"`
	Developer featureMode `json:"developer"`
}

type publicStatus struct {
	CheckedAt             time.Time      `json:"checked_at"`
	API                   bool           `json:"api"`
	Database              bool           `json:"database"`
	Features              publicFeatures `json:"features"`
	LiveProviderConnected bool           `json:"live_provider_connected"`
	PaymentsConnected     bool           `json:"payments_connected"`
}

// Only capabilities and aggregate readiness are public. No tenant data, inventory,
// secrets, upstream addresses or database diagnostics are included.
func publicStatusHandler(pool *pgxpool.Pool, development bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		ready := pool.Ping(ctx) == nil
		identityMode := featureActive
		if !ready {
			identityMode = featureUnavailable
		}
		mode := featureDisabled
		if development {
			mode = featureMock
			if !ready {
				mode = featureUnavailable
			}
		}
		httpx.JSON(w, http.StatusOK, publicStatus{
			CheckedAt: time.Now().UTC(), API: true, Database: ready,
			Features: publicFeatures{Identity: identityMode, Catalog: mode, Numbers: mode, Messaging: mode, Billing: mode, Developer: mode},
			// No live provider or payment adapter is implemented in this build.
			LiveProviderConnected: false, PaymentsConnected: false,
		})
	}
}
