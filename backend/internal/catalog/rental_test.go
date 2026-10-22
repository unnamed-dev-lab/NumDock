package catalog

import "testing"

func TestRentalPrice(t *testing.T) {
	for _, tt := range []struct {
		monthly, days int32
		want          int64
		valid         bool
	}{
		{350, 3, 35, true}, {350, 7, 82, true}, {350, 30, 350, true},
		{301, 3, 31, true}, {0, 7, 0, true}, {2147483647, 7, 501079518, true},
		{350, 0, 0, false}, {350, 1, 0, false}, {350, 31, 0, false}, {-1, 3, 0, false},
	} {
		got, ok := RentalPrice(tt.monthly, tt.days)
		if got != tt.want || ok != tt.valid {
			t.Errorf("monthly=%d days=%d: got %d,%v want %d,%v", tt.monthly, tt.days, got, ok, tt.want, tt.valid)
		}
	}
}
