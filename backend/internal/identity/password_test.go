package identity

import (
	"strings"
	"testing"
)

func TestPasswordHash(t *testing.T) {
	password := "a long passphrase with spaces"
	first, err := hashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	second, err := hashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("password salts must be random")
	}
	if !verifyPassword(password, first) || verifyPassword("incorrect passphrase", first) {
		t.Fatal("password verification failed")
	}
	for _, malformed := range []string{"", "$argon2id$v=19$m=999999999,t=99,p=99$bad$bad", hashPrefix + "bad$bad"} {
		if verifyPassword(password, malformed) {
			t.Fatal("accepted malformed hash")
		}
	}
}

func TestPasswordBounds(t *testing.T) {
	for _, value := range []string{"", "too short", strings.Repeat("a", 129), strings.Repeat("中", 11)} {
		if ValidatePassword(value) == nil {
			t.Fatal("accepted short password")
		}
	}
	if ValidatePassword("a valid long passphrase") != nil {
		t.Fatal("rejected valid passphrase")
	}
	if ValidatePassword(strings.Repeat("中", 12)) != nil {
		t.Fatal("rejected valid Unicode passphrase")
	}
}
