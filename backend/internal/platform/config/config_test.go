package config

import "testing"

func TestProductionRequiresSecureOriginAndCookie(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	cases := []struct {
		origin, secure string
		valid          bool
	}{
		{"https://numdock.example", "true", true},
		{"https://numdock.example", "false", false},
		{"http://numdock.example", "true", false},
		{"http://localhost:5173", "false", true},
		{"https://numdock.example/path", "true", false},
		{"https://user:secret@numdock.example", "true", false},
	}
	for _, tc := range cases {
		t.Run(tc.origin+tc.secure, func(t *testing.T) {
			t.Setenv("APP_ORIGIN", tc.origin)
			t.Setenv("COOKIE_SECURE", tc.secure)
			_, err := Load()
			if (err == nil) != tc.valid {
				t.Fatalf("unexpected validity: %v", err)
			}
		})
	}
}
