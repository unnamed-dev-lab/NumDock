package overview

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("organization not found")

type Day struct {
	Date             string `json:"date"`
	ActiveNumbers    int64  `json:"active_numbers"`
	MessagesReceived int64  `json:"messages_received"`
	MessagesFailed   int64  `json:"messages_failed"`
	OrdersCompleted  int64  `json:"orders_completed"`
	SpendMinor       int64  `json:"spend_minor"`
}

type Totals struct {
	ActiveNumbers    int64 `json:"active_numbers"`
	MessagesReceived int64 `json:"messages_received"`
	MessagesFailed   int64 `json:"messages_failed"`
	OrdersCompleted  int64 `json:"orders_completed"`
	SpendMinor       int64 `json:"spend_minor"`
}

type Telemetry struct {
	Instrumented       bool `json:"instrumented"`
	ExporterConfigured bool `json:"exporter_configured"`
}

type Summary struct {
	OrganizationID string     `json:"organization_id"`
	Mode           string     `json:"mode"`
	Currency       string     `json:"currency"`
	Days           int        `json:"days"`
	RangeStart     string     `json:"range_start"`
	RangeEnd       string     `json:"range_end"`
	SeededAt       *time.Time `json:"seeded_at"`
	Totals         Totals     `json:"totals"`
	Series         []Day      `json:"series"`
	Telemetry      Telemetry  `json:"telemetry"`
}

type Snapshot struct {
	Days     []Day
	SeededAt *time.Time
}

type Store interface {
	// Snapshot checks membership even when includeDemo is false, and reads under
	// a consistent transaction. No organization ownership is trusted from the URL.
	Snapshot(context.Context, string, string, time.Time, time.Time, bool) (Snapshot, error)
}

type Service struct {
	store       Store
	development bool
	telemetry   Telemetry
}

func NewService(store Store, development bool, telemetry Telemetry) *Service {
	return &Service{store: store, development: development, telemetry: telemetry}
}

func (s *Service) Get(ctx context.Context, userID, organizationID string, days int, now time.Time) (Summary, error) {
	end := now.UTC().Truncate(24 * time.Hour)
	start := end.AddDate(0, 0, 1-days)
	snapshot, err := s.store.Snapshot(ctx, userID, organizationID, start, end, s.development)
	if err != nil {
		return Summary{}, err
	}
	result := Summary{OrganizationID: organizationID, Mode: "disabled", Currency: "USD", Days: days, RangeStart: start.Format(time.DateOnly), RangeEnd: end.Format(time.DateOnly), Series: []Day{}, Telemetry: s.telemetry}
	if !s.development {
		return result, nil
	}
	result.Mode = "empty"
	if len(snapshot.Days) == 0 {
		return result, nil
	}
	result.Mode, result.SeededAt = "mock", snapshot.SeededAt
	byDay := make(map[string]Day, len(snapshot.Days))
	for _, d := range snapshot.Days {
		byDay[d.Date] = d
	}
	for date := start; !date.After(end); date = date.AddDate(0, 0, 1) {
		key := date.Format(time.DateOnly)
		d, exists := byDay[key]
		if !exists {
			d = Day{Date: key}
		}
		result.Series = append(result.Series, d)
		result.Totals.MessagesReceived += d.MessagesReceived
		result.Totals.MessagesFailed += d.MessagesFailed
		result.Totals.OrdersCompleted += d.OrdersCompleted
		result.Totals.SpendMinor += d.SpendMinor
	}
	// Active numbers are a snapshot, never a sum of daily snapshots.
	result.Totals.ActiveNumbers = snapshot.Days[len(snapshot.Days)-1].ActiveNumbers
	return result, nil
}
