package server_test

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

func TestOpenAPIDocumentIsServed(t *testing.T) {
	f := setup(t)
	resp, err := http.Get(f.server.URL + "/v1/openapi.yaml")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if got := resp.Header.Get("Content-Type"); !strings.HasPrefix(got, "application/yaml") {
		t.Fatalf("Content-Type = %q", got)
	}
	if resp.Header.Get("X-Request-ID") == "" || resp.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("missing response safety headers")
	}
	document, err := openapi3.NewLoader().LoadFromData(body)
	if err != nil {
		t.Fatal(err)
	}
	if err := document.Validate(context.Background()); err != nil {
		t.Fatal(err)
	}
	if document.Paths.Find("/v1/me") == nil {
		t.Fatal("served contract is missing /v1/me")
	}
}
