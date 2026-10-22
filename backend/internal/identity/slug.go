package identity

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"unicode"
)

// OrganizationSlug is assigned once and persisted; renaming an organization
// does not break bookmarks. The random suffix separates duplicate names.
func OrganizationSlug(name string) (string, error) {
	base := make([]rune, 0, 60)
	for _, r := range strings.ToLower(name) {
		if len(base) >= 60 {
			break
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			base = append(base, r)
		} else if len(base) > 0 && base[len(base)-1] != '-' {
			base = append(base, '-')
		}
	}
	prefix := strings.Trim(string(base), "-")
	if prefix == "" {
		prefix = "workspace"
	}
	var suffix [8]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		return "", err
	}
	return prefix + "-" + hex.EncodeToString(suffix[:]), nil
}
