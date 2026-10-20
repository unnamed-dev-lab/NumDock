package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"numdock/backend/internal/identity"
	"numdock/backend/internal/platform/httpx"
)

func TestInternalErrorMapping(t *testing.T) {
	var logs bytes.Buffer
	h := &Handler{logger: slog.New(slog.NewJSONHandler(&logs, nil))}
	base := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	base = base.WithContext(httpx.WithRequestID(base.Context(), "request-123"))

	t.Run("deadline becomes gateway timeout", func(t *testing.T) {
		logs.Reset()
		ctx, cancel := context.WithDeadline(base.Context(), time.Now().Add(-time.Second))
		defer cancel()
		rec := httptest.NewRecorder()
		h.internal(rec, base.WithContext(ctx), context.DeadlineExceeded)

		if rec.Code != http.StatusGatewayTimeout {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusGatewayTimeout)
		}
		var body httpx.Error
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Code != "request_timeout" || body.RequestID != "request-123" {
			t.Fatalf("unexpected error envelope: %+v", body)
		}
		if !strings.Contains(logs.String(), "deadline_exceeded") || !strings.Contains(logs.String(), "request-123") {
			t.Fatalf("timeout log missing fields: %s", logs.String())
		}
	})

	t.Run("canceled writes nothing", func(t *testing.T) {
		logs.Reset()
		ctx, cancel := context.WithCancel(base.Context())
		cancel()
		rec := httptest.NewRecorder()
		h.internal(rec, base.WithContext(ctx), context.Canceled)

		if rec.Body.Len() != 0 {
			t.Fatalf("canceled request wrote a body: %s", rec.Body.String())
		}
		if !strings.Contains(logs.String(), "canceled") || !strings.Contains(logs.String(), "request-123") {
			t.Fatalf("canceled log missing fields: %s", logs.String())
		}
	})

	t.Run("unknown error becomes internal error", func(t *testing.T) {
		logs.Reset()
		rec := httptest.NewRecorder()
		h.internal(rec, base, errors.New("database password and message content"))

		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
		}
		var body httpx.Error
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Code != "internal_error" || body.RequestID != "request-123" {
			t.Fatalf("unexpected error envelope: %+v", body)
		}
		if strings.Contains(logs.String(), "database password") {
			t.Fatal("internal error text leaked into logs")
		}
	})
}

func TestErrorType(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"deadline", context.DeadlineExceeded, "deadline_exceeded"},
		{"canceled", context.Canceled, "canceled"},
		{"wrapped deadline", errors.Join(errors.New("query failed"), context.DeadlineExceeded), "deadline_exceeded"},
		{"store sqlstate", &identity.StoreError{Operation: "query", Code: "23505"}, "database_23505"},
		{"store without code", &identity.StoreError{Operation: "query"}, "database"},
		{"unknown", errors.New("boom"), "internal"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := errorType(tc.err); got != tc.want {
				t.Fatalf("errorType() = %q, want %q", got, tc.want)
			}
		})
	}
}
