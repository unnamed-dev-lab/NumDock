package identity

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestOrganizationSlug(t *testing.T) {
	for _, tc := range []struct{ name, prefix string }{
		{"  Acme & Partners  ", "acme-partners-"},
		{"组织 工作区", "组织-工作区-"},
		{"!!!", "workspace-"},
		{strings.Repeat("a ", 100), strings.Repeat("a-", 29) + "a-"},
	} {
		first, err := OrganizationSlug(tc.name)
		if err != nil {
			t.Fatal(err)
		}
		second, err := OrganizationSlug(tc.name)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(first, tc.prefix) || first == second || utf8.RuneCountInString(first) > 100 {
			t.Fatalf("unsafe, duplicate or unreadable slug: %q", first)
		}
	}
}
