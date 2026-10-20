package server_test

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"numdock/backend/internal/httpx"
)

func TestRequestIDsAreServerGenerated(t *testing.T) {
	f := setup(t)
	client := newClient(t)

	req, err := http.NewRequest(http.MethodGet, f.server.URL+"/healthz", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-Request-ID", "client-supplied-id")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	assertContract(t, http.MethodGet, "/healthz", resp.StatusCode, data)
	first := resp.Header.Get("X-Request-ID")
	if first == "" || first == "client-supplied-id" {
		t.Fatalf("client-supplied request ID was trusted: %q", first)
	}
	if strings.ContainsAny(first, "/\\") {
		t.Fatalf("request ID exposes host or path characters: %q", first)
	}

	status, _, headers := request(t, client, http.MethodGet, f.server.URL+"/healthz", "", "", "")
	second := headers.Get("X-Request-ID")
	if status != http.StatusOK || second == "" || second == first {
		t.Fatalf("request IDs are not fresh: first=%q second=%q status=%d", first, second, status)
	}

	status, body, headers := request(t, client, http.MethodGet, f.server.URL+"/v1/me", "", "", "")
	if status != http.StatusUnauthorized {
		t.Fatalf("anonymous /v1/me status = %d", status)
	}
	var envelope httpx.Error
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.RequestID == "" || envelope.RequestID != headers.Get("X-Request-ID") {
		t.Fatalf("error envelope request ID does not match header: envelope=%q header=%q", envelope.RequestID, headers.Get("X-Request-ID"))
	}

	req, err = http.NewRequest(http.MethodGet, f.server.URL+"/v1/does-not-exist", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, err = io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("missing route status = %d", resp.StatusCode)
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.RequestID == "" || envelope.RequestID != resp.Header.Get("X-Request-ID") {
		t.Fatalf("not-found request ID mismatch: envelope=%q header=%q", envelope.RequestID, resp.Header.Get("X-Request-ID"))
	}
}

func TestOversizedAuthPayloadReturns413(t *testing.T) {
	f := setup(t)
	client := newClient(t)
	csrf := token(t, f, client)
	oversized := `{"email":"large@example.com","password":"` + strings.Repeat("a", 9000) + `"}`

	for _, path := range []string{"/v1/auth/login", "/v1/auth/register"} {
		t.Run(path, func(t *testing.T) {
			status, body, headers := request(t, client, http.MethodPost, f.server.URL+path, csrf, oversized, "http://client.test")
			if status != http.StatusRequestEntityTooLarge {
				t.Fatalf("status = %d, want %d; body=%s", status, http.StatusRequestEntityTooLarge, body)
			}
			var envelope httpx.Error
			if err := json.Unmarshal(body, &envelope); err != nil {
				t.Fatal(err)
			}
			if envelope.Code != "payload_too_large" {
				t.Fatalf("code = %q", envelope.Code)
			}
			if envelope.RequestID == "" || envelope.RequestID != headers.Get("X-Request-ID") {
				t.Fatalf("request ID mismatch: envelope=%q header=%q", envelope.RequestID, headers.Get("X-Request-ID"))
			}
		})
	}

	t.Run("oversized trailing data", func(t *testing.T) {
		body := `{"email":"large2@example.com","password":"a sufficiently long passphrase"}` + strings.Repeat(" ", 9000)
		status, data, _ := request(t, client, http.MethodPost, f.server.URL+"/v1/auth/login", csrf, body, "http://client.test")
		if status != http.StatusRequestEntityTooLarge {
			t.Fatalf("status = %d, want %d; body=%s", status, http.StatusRequestEntityTooLarge, data)
		}
	})
}
