package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIPResolverRequiresTrustedPeer(t *testing.T) {
	for _, resolver := range []*ClientIPResolver{nil, &ClientIPResolver{}} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "192.0.2.10:1234"
		req.Header.Set("X-Forwarded-For", "203.0.113.1")
		if got := resolver.ClientIP(req); got != "192.0.2.10" {
			t.Fatalf("resolver %+v returned %q", resolver, got)
		}
	}
}

func TestClientIPResolverWalksTrustedProxyChain(t *testing.T) {
	resolver, err := NewClientIPResolver([]string{"10.0.0.0/8"})
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name    string
		xff     string
		want    string
		headers []string
	}{
		{name: "rightmost untrusted hop", xff: "198.51.100.7, 10.0.0.9", want: "198.51.100.7"},
		{name: "ignore spoofed leftmost hop", xff: "1.1.1.1, 203.0.113.5", want: "203.0.113.5"},
		{name: "all hops trusted", xff: "10.0.0.3, 10.0.0.9", want: "10.0.0.3"},
		{name: "malformed hop stops traversal", xff: "198.51.100.7, garbage", want: "10.0.0.2"},
		{name: "hop with port", xff: "203.0.113.9:5555", want: "203.0.113.9"},
		{name: "multiple header values", headers: []string{"198.51.100.7", "203.0.113.5"}, want: "203.0.113.5"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = "10.0.0.2:1234"
			for _, value := range tc.headers {
				req.Header.Add("X-Forwarded-For", value)
			}
			if tc.xff != "" {
				req.Header.Set("X-Forwarded-For", tc.xff)
			}
			if got := resolver.ClientIP(req); got != tc.want {
				t.Fatalf("ClientIP() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestClientIPResolverIPv6(t *testing.T) {
	resolver, err := NewClientIPResolver([]string{"::1"})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "[::1]:1234"
	req.Header.Set("X-Forwarded-For", "2001:db8::1")
	if got := resolver.ClientIP(req); got != "2001:db8::1" {
		t.Fatalf("ClientIP() = %q", got)
	}

	req.RemoteAddr = "[fe80::1%eth0]:1234"
	zoneResolver, err := NewClientIPResolver([]string{"fe80::/10"})
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Del("X-Forwarded-For")
	if got := zoneResolver.ClientIP(req); got != "fe80::1" {
		t.Fatalf("zoned ClientIP() = %q", got)
	}
}

func TestNewClientIPResolverRejectsInvalidEntries(t *testing.T) {
	for _, entry := range []string{"not-an-ip", "10.0.0.0/99", "2001:db8::/129"} {
		if _, err := NewClientIPResolver([]string{entry}); err == nil {
			t.Fatalf("accepted invalid trusted proxy %q", entry)
		}
	}
}
