package catalog

import "context"

type Item struct {
	ID                  string   `json:"id"`
	E164                string   `json:"e164"`
	CountryCode         string   `json:"country_code"`
	CountryName         string   `json:"country_name"`
	Region              string   `json:"region"`
	NumberType          string   `json:"number_type"`
	Capabilities        []string `json:"capabilities"`
	Provider            string   `json:"provider"`
	Source              string   `json:"source"`
	Currency            string   `json:"currency"`
	MonthlyFeeMinor     int32    `json:"monthly_fee_minor"`
	InboundSMSFeeMicros int32    `json:"inbound_sms_fee_micros"`
	Status              string   `json:"status"`
}

type Filter struct {
	Country, NumberType, Capability, Search, SortBy, SortOrder string
	Limit, Offset                                              int32
}

type List struct {
	Items  []Item `json:"items"`
	Total  int64  `json:"total"`
	Limit  int32  `json:"limit"`
	Offset int32  `json:"offset"`
	Mode   string `json:"mode"`
}

type Store interface {
	List(context.Context, Filter) ([]Item, int64, error)
}

type Service struct {
	store       Store
	development bool
}

func NewService(store Store, development bool) *Service {
	return &Service{store: store, development: development}
}

func (s *Service) List(ctx context.Context, f Filter) (List, error) {
	result := List{Items: []Item{}, Limit: f.Limit, Offset: f.Offset, Mode: "disabled"}
	// Even a copied development database must never expose fixtures as live stock.
	if !s.development {
		return result, nil
	}
	result.Mode = "mock"
	items, total, err := s.store.List(ctx, f)
	if err != nil {
		return List{}, err
	}
	result.Items, result.Total = items, total
	return result, nil
}
