package safehttp

import (
	"net/netip"
	"testing"
)

func TestRejectPrivateAndAmbiguousWebhookDestinations(t *testing.T) {
	for _, raw := range []string{"http://example.com", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://[::ffff:127.0.0.1]", "https://10.1.2.3", "https://169.254.169.254", "https://100.64.0.1", "https://192.0.2.1", "https://user:secret@example.com", "https://example.com?secret=x", "https://example.com:8443", "mock://anything"} {
		if Validate(raw) == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
	for _, raw := range []string{"https://example.com/events", "mock://success", "mock://failure"} {
		if Validate(raw) != nil {
			t.Fatalf("rejected %s", raw)
		}
	}
	for _, raw := range []string{"0.0.0.0", "224.0.0.1", "fc00::1", "fe80::1", "::ffff:10.0.0.1"} {
		if Public(netip.MustParseAddr(raw)) {
			t.Fatal("non-public address allowed")
		}
	}
	if Client().Transport == nil || Client().CheckRedirect == nil {
		t.Fatal("unprotected HTTP transport")
	}
}
