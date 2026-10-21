// Package operations coordinates the development-only communication workspace.
// PostgreSQL owns the complete mock transaction lifecycle; no live provider or payment is implied.
package operations

import (
	"context"
	"time"
)

type Error struct{ Code string }

func (e *Error) Error() string { return e.Code }
func Fail(code string) error   { return &Error{Code: code} }

type Actor struct {
	UserID, OrganizationID, KeyID string
	Scopes                        []string
}
type Filter struct {
	View, Status, Search string
	Limit, Offset        int32
}
type Command struct {
	Kind            string   `json:"-"`
	ResourceID      string   `json:"-"`
	AmountMinor     int64    `json:"amount_minor,omitempty"`
	CatalogItemID   string   `json:"catalog_item_id,omitempty"`
	Purpose         string   `json:"purpose,omitempty"`
	ConfirmedTerms  bool     `json:"confirmed_terms,omitempty"`
	SimulateFailure bool     `json:"simulate_failure,omitempty"`
	LeaseID         string   `json:"lease_id,omitempty"`
	Body            string   `json:"body,omitempty"`
	Name            string   `json:"name,omitempty"`
	Scopes          []string `json:"scopes,omitempty"`
	ExpiresDays     int      `json:"expires_days,omitempty"`
	URL             string   `json:"url,omitempty"`
	Enabled         bool     `json:"enabled,omitempty"`
}
type Wallet struct {
	Currency       string `json:"currency"`
	AvailableMinor int64  `json:"available_minor"`
	ReservedMinor  int64  `json:"reserved_minor"`
}
type Counts struct {
	Numbers         int64 `json:"numbers"`
	UnreadMessages  int64 `json:"unread_messages"`
	CompletedOrders int64 `json:"completed_orders"`
}
type Number struct {
	ID              string    `json:"id"`
	E164            string    `json:"e164"`
	Status          string    `json:"status"`
	CountryCode     string    `json:"country_code"`
	NumberType      string    `json:"number_type"`
	Capabilities    []string  `json:"capabilities"`
	MonthlyFeeMinor int32     `json:"monthly_fee_minor"`
	StartedAt       time.Time `json:"started_at"`
	ExpiresAt       time.Time `json:"expires_at"`
	OrderID         string    `json:"order_id"`
}
type Order struct {
	ID          string    `json:"id"`
	E164        string    `json:"e164"`
	Status      string    `json:"status"`
	Purpose     string    `json:"purpose"`
	AmountMinor int64     `json:"amount_minor"`
	FailureCode string    `json:"failure_code"`
	CreatedAt   time.Time `json:"created_at"`
}
type Ledger struct {
	ID             string    `json:"id"`
	ReferenceID    string    `json:"reference_id"`
	Kind           string    `json:"kind"`
	AvailableDelta int64     `json:"available_delta"`
	ReservedDelta  int64     `json:"reserved_delta"`
	AvailableAfter int64     `json:"available_after"`
	ReservedAfter  int64     `json:"reserved_after"`
	CreatedAt      time.Time `json:"created_at"`
}
type Message struct {
	ID         string    `json:"id"`
	LeaseID    string    `json:"lease_id"`
	E164       string    `json:"e164"`
	ReceivedAt time.Time `json:"received_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	Read       bool      `json:"read"`
	Body       string    `json:"body,omitempty"`
}
type APIKey struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Prefix    string    `json:"prefix"`
	Scopes    []string  `json:"scopes"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Revoked   bool      `json:"revoked"`
}
type Webhook struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
}
type Delivery struct {
	ID             string    `json:"id"`
	EndpointID     string    `json:"endpoint_id"`
	EventID        int64     `json:"event_id"`
	Status         string    `json:"status"`
	Attempts       int32     `json:"attempts"`
	ResponseStatus int32     `json:"response_status"`
	CreatedAt      time.Time `json:"created_at"`
}
type Event struct {
	ID         int64  `json:"id"`
	Type       string `json:"type"`
	ResourceID string `json:"resource_id"`
}
type Snapshot struct {
	Mode       string     `json:"mode"`
	Role       string     `json:"role"`
	Wallet     Wallet     `json:"wallet"`
	Counts     Counts     `json:"counts"`
	Numbers    []Number   `json:"numbers"`
	Orders     []Order    `json:"orders"`
	Ledger     []Ledger   `json:"ledger"`
	Messages   []Message  `json:"messages"`
	APIKeys    []APIKey   `json:"api_keys"`
	Webhooks   []Webhook  `json:"webhooks"`
	Deliveries []Delivery `json:"deliveries"`
	Total      int64      `json:"total"`
	Limit      int32      `json:"limit"`
	Offset     int32      `json:"offset"`
}
type Result struct {
	ID      string   `json:"id"`
	Status  string   `json:"status"`
	Secret  string   `json:"secret,omitempty"`
	Order   *Order   `json:"order,omitempty"`
	Number  *Number  `json:"number,omitempty"`
	Wallet  *Wallet  `json:"wallet,omitempty"`
	Key     *APIKey  `json:"key,omitempty"`
	Webhook *Webhook `json:"webhook,omitempty"`
}
type Incoming struct {
	Raw        []byte    `json:"-"`
	ID         string    `json:"id"`
	LeaseID    string    `json:"lease_id"`
	Body       string    `json:"body"`
	OccurredAt time.Time `json:"occurred_at"`
}
type Store interface {
	Read(context.Context, Actor, Filter) (Snapshot, error)
	Execute(context.Context, Actor, string, Command) (Result, error)
	Message(context.Context, Actor, string) (Message, error)
	Authenticate(context.Context, string) (Actor, error)
	Events(context.Context, Actor, int64) ([]Event, error)
	Ingest(context.Context, Incoming) (string, error)
}
