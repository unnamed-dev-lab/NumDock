package httpx

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewRequestIDIsUniqueAndServerShaped(t *testing.T) {
	seen := make(map[string]struct{}, 256)
	for i := 0; i < 256; i++ {
		id := NewRequestID()
		if id == "" || strings.ContainsAny(id, "/+= \r\n") {
			t.Fatalf("unusable request ID: %q", id)
		}
		if _, exists := seen[id]; exists {
			t.Fatalf("duplicate request ID: %q", id)
		}
		seen[id] = struct{}{}
	}
}

func TestRequestIDContextRoundTrip(t *testing.T) {
	ctx := WithRequestID(context.Background(), "request-123")
	if got := RequestID(ctx); got != "request-123" {
		t.Fatalf("RequestID() = %q", got)
	}
	if got := RequestID(context.Background()); got != "" {
		t.Fatalf("empty context RequestID() = %q", got)
	}
}

func TestFailUsesContextRequestID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req = req.WithContext(WithRequestID(req.Context(), "request-456"))
	rec := httptest.NewRecorder()
	Fail(rec, req, http.StatusBadRequest, "validation_failed", "Check the request.")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
		t.Fatalf("Content-Type = %q", got)
	}
	var body Error
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != "validation_failed" || body.RequestID != "request-456" {
		t.Fatalf("unexpected error envelope: %+v", body)
	}
}
