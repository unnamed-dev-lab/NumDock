package catalog

// RentalOption is an authoritative, development-only quote for a fixed term.
type RentalOption struct {
	Days        int32 `json:"days"`
	AmountMinor int64 `json:"amount_minor"`
}

// RentalPrice prorates the 30-day price using integer cents, rounding up.
func RentalPrice(monthlyMinor, days int32) (int64, bool) {
	if monthlyMinor < 0 || (days != 3 && days != 7 && days != 30) {
		return 0, false
	}
	return (int64(monthlyMinor)*int64(days) + 29) / 30, true
}

func RentalOptions(monthlyMinor int32) []RentalOption {
	options := make([]RentalOption, 0, 3)
	for _, days := range []int32{3, 7, 30} {
		amount, ok := RentalPrice(monthlyMinor, days)
		if ok {
			options = append(options, RentalOption{Days: days, AmountMinor: amount})
		}
	}
	return options
}
