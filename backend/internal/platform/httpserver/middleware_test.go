package httpserver

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"numdock/backend/internal/platform/httpx"
)

type countingRecorder struct {
	*httptest.ResponseRecorder
	headerWrites int
}

func (r *countingRecorder) WriteHeader(code int) {
	r.headerWrites++
	r.ResponseRecorder.WriteHeader(code)
}

func testLogger(logs *bytes.Buffer) *slog.Logger {
	return slog.New(slog.NewJSONHandler(logs, nil))
}

func TestRequestIDIgnoresClientValue(t *testing.T) {
	var observed string
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observed = httpx.RequestID(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/test", nil)
	req.Header.Set("X-Request-ID", "client-supplied-id")
	handler.ServeHTTP(rec, req)

	id := rec.Header().Get("X-Request-ID")
	if id == "" || id == "client-supplied-id" {
		t.Fatalf("request ID was not server-generated: %q", id)
	}
	if observed != id {
		t.Fatalf("context request ID = %q, response header = %q", observed, id)
	}
}

func TestLoggingSetsSafetyHeadersAndLogsRequest(t *testing.T) {
	var logs bytes.Buffer
	handler := RequestID(Logging(testLogger(&logs))(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/test?secret=value", nil))

	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q", got)
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("X-Content-Type-Options = %q", got)
	}
	if got := rec.Header().Get("Referrer-Policy"); got != "no-referrer" {
		t.Fatalf("Referrer-Policy = %q", got)
	}
	for _, want := range []string{`"status":204`, `"path":"/v1/test"`, `"request_id":`, `"duration_ms":`} {
		if !strings.Contains(logs.String(), want) {
			t.Fatalf("request log missing %s: %s", want, logs.String())
		}
	}
	if strings.Contains(logs.String(), "secret=value") {
		t.Fatal("request log included query string")
	}
}

func TestRecoverer(t *testing.T) {
	tests := []struct {
		name        string
		handler     http.HandlerFunc
		wantStatus  int
		wantBody    string
		wantStarted bool
	}{
		{
			name: "before response",
			handler: func(w http.ResponseWriter, r *http.Request) {
				panic("database password leaked in panic")
			},
			wantStatus: http.StatusInternalServerError,
			wantBody:   `"code":"internal_error"`,
		},
		{
			name: "after response started",
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("partial"))
				panic("boom")
			},
			wantStatus:  http.StatusOK,
			wantBody:    "partial",
			wantStarted: true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var logs bytes.Buffer
			handler := RequestID(Recoverer(testLogger(&logs))(tc.handler))
			rec := &countingRecorder{ResponseRecorder: httptest.NewRecorder()}
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/test", nil))

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if !strings.Contains(rec.Body.String(), tc.wantBody) {
				t.Fatalf("body = %q, want substring %q", rec.Body.String(), tc.wantBody)
			}
			if rec.headerWrites != 1 {
				t.Fatalf("WriteHeader called %d times, want 1", rec.headerWrites)
			}
			logged := logs.String()
			for _, want := range []string{"request panic", "panic_type", "stack", "request_id"} {
				if !strings.Contains(logged, want) {
					t.Fatalf("panic log missing %s: %s", want, logged)
				}
			}
			if strings.Contains(logged, "database password") {
				t.Fatal("panic value leaked into logs")
			}
			if tc.wantStarted && !strings.Contains(logged, `"response_started":true`) {
				t.Fatalf("panic log missing response_started: %s", logged)
			}
		})
	}
}

func TestTimeout(t *testing.T) {
	t.Run("writes gateway timeout when handler returns without response", func(t *testing.T) {
		var logs bytes.Buffer
		handler := RequestID(Logging(testLogger(&logs))(Timeout(20 * time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			<-r.Context().Done()
		}))))
		rec := &countingRecorder{ResponseRecorder: httptest.NewRecorder()}
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/test", nil))

		if rec.Code != http.StatusGatewayTimeout {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusGatewayTimeout)
		}
		if rec.headerWrites != 1 {
			t.Fatalf("WriteHeader called %d times, want 1", rec.headerWrites)
		}
		var body httpx.Error
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Code != "request_timeout" || body.RequestID == "" {
			t.Fatalf("unexpected timeout envelope: %+v", body)
		}
		if body.RequestID != rec.Header().Get("X-Request-ID") {
			t.Fatalf("timeout request ID mismatch: envelope=%q header=%q", body.RequestID, rec.Header().Get("X-Request-ID"))
		}
		if !strings.Contains(logs.String(), `"status":504`) {
			t.Fatalf("request log missing 504 status: %s", logs.String())
		}
	})

	t.Run("does not overwrite a response already written by handler", func(t *testing.T) {
		handler := RequestID(Timeout(20 * time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			<-r.Context().Done()
			httpx.Fail(w, r, http.StatusInternalServerError, "internal_error", "already written")
		})))
		rec := &countingRecorder{ResponseRecorder: httptest.NewRecorder()}
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/test", nil))

		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
		}
		if rec.headerWrites != 1 {
			t.Fatalf("WriteHeader called %d times, want 1", rec.headerWrites)
		}
	})
}
