package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/go-chi/chi/v5"
	"io"
	"log/slog"
	"net/http"
	identityhttp "numdock/backend/internal/identity/httpapi"
	"numdock/backend/internal/operations"
	"numdock/backend/internal/platform/httpx"
	"strconv"
	"strings"
	"time"
)

type Handler struct {
	store       operations.Store
	identity    *identityhttp.Handler
	logger      *slog.Logger
	providerKey []byte
}

func New(s operations.Store, i *identityhttp.Handler, logger *slog.Logger, key []byte) *Handler {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte("numdock/mock-provider-webhook"))
	return &Handler{store: s, identity: i, logger: logger, providerKey: mac.Sum(nil)}
}

type actorKey struct{}

func actor(r *http.Request) operations.Actor { return r.Context().Value(actorKey{}).(operations.Actor) }
func (h *Handler) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		org := chi.URLParam(r, "organization_id")
		if len(org) > 128 {
			h.fail(w, r, operations.Fail("not_found"))
			return
		}
		proceed := func(a operations.Actor) {
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), actorKey{}, a)))
		}
		if r.Header.Get("Authorization") != "" {
			h.fail(w, r, operations.Fail("unauthenticated"))
			return
		}
		h.identity.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, authed *http.Request) {
			u, _ := identityhttp.UserFromContext(authed.Context())
			r = authed
			a := operations.Actor{UserID: u.ID, OrganizationID: org}
			if r.Method != http.MethodGet {
				h.identity.Protect(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { proceed(a) })).ServeHTTP(w, r)
			} else {
				proceed(a)
			}
		})).ServeHTTP(w, r)
	})
}
func (h *Handler) Routes(r chi.Router) {
	r.Post("/providers/mock/webhook", h.incoming)
	r.Route("/organizations/{organization_id}", func(r chi.Router) {
		r.Use(h.auth)
		for _, resource := range []struct{ path, view string }{
			{"/summary", "summary"}, {"/billing/wallet", "wallet"}, {"/numbers", "numbers"}, {"/messages", "messages"}, {"/orders", "orders"}, {"/billing/ledger", "ledger"}, {"/billing/payments", "payments"},
		} {
			r.Get(resource.path, h.resource(resource.view))
		}
		r.Get("/billing/payments/{resource_id}", h.payment)
		r.Get("/messages/{resource_id}", h.message)
		r.Get("/events/stream", h.stream)
		for _, route := range []struct{ path, kind string }{
			{"/billing/payments", "create_payment"}, {"/billing/payments/{resource_id}/confirm", "pay_payment"}, {"/billing/payments/{resource_id}/cancel", "cancel_payment"}, {"/orders", "purchase"}, {"/leases/{resource_id}/release", "release"}, {"/orders/{resource_id}/refund", "refund"}, {"/messages/simulate", "simulate"},
		} {
			r.Post(route.path, h.command(route.kind))
		}
		r.Delete("/messages/{resource_id}", h.command("delete_message"))
	})
}
func (h *Handler) resource(view string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f := operations.Filter{View: view, Limit: 20}
		allowed := map[string]bool{"limit": true, "offset": true, "status": true, "q": true}
		for key, values := range r.URL.Query() {
			if !allowed[key] || len(values) != 1 || view == "summary" || view == "wallet" {
				h.fail(w, r, operations.Fail("validation_failed"))
				return
			}
		}
		f.Status, f.Search = r.URL.Query().Get("status"), strings.TrimSpace(r.URL.Query().Get("q"))
		for key, target := range map[string]*int32{"limit": &f.Limit, "offset": &f.Offset} {
			if r.URL.Query().Has(key) {
				v, err := strconv.ParseInt(r.URL.Query().Get(key), 10, 32)
				if err != nil || v < 0 {
					h.fail(w, r, operations.Fail("validation_failed"))
					return
				}
				*target = int32(v)
			}
		}
		valid := map[string][]string{"summary": {""}, "wallet": {""}, "numbers": {"", "active", "released", "expired"}, "messages": {"", "read", "unread"}, "orders": {"", "completed", "failed", "refunded"}, "ledger": {""}, "payments": {"", "pending", "succeeded", "failed", "canceled", "expired"}}
		found := false
		for _, status := range valid[view] {
			found = found || status == f.Status
		}
		if !found || f.Limit < 1 || f.Limit > 100 || f.Offset > 100000 || len(f.Search) > 80 {
			h.fail(w, r, operations.Fail("validation_failed"))
			return
		}
		result, err := h.store.Read(r.Context(), actor(r), f)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		switch view {
		case "summary":
			httpx.JSON(w, 200, operations.Summary{Mode: result.Mode, Role: result.Role, Wallet: result.Wallet, Counts: result.Counts})
		case "wallet":
			httpx.JSON(w, 200, operations.WalletState{Mode: result.Mode, Wallet: result.Wallet})
		case "numbers":
			httpx.JSON(w, 200, operations.List[operations.Number]{Items: result.Numbers, Mode: result.Mode, Total: result.Total, Limit: result.Limit, Offset: result.Offset})
		case "messages":
			httpx.JSON(w, 200, operations.List[operations.Message]{Items: result.Messages, Mode: result.Mode, Total: result.Total, Limit: result.Limit, Offset: result.Offset})
		case "orders":
			httpx.JSON(w, 200, operations.List[operations.Order]{Items: result.Orders, Mode: result.Mode, Total: result.Total, Limit: result.Limit, Offset: result.Offset})
		case "ledger":
			httpx.JSON(w, 200, operations.List[operations.Ledger]{Items: result.Ledger, Mode: result.Mode, Total: result.Total, Limit: result.Limit, Offset: result.Offset})
		case "payments":
			httpx.JSON(w, 200, operations.List[operations.Payment]{Items: result.Payments, Mode: result.Mode, Total: result.Total, Limit: result.Limit, Offset: result.Offset})
		}
	}
}
func (h *Handler) payment(w http.ResponseWriter, r *http.Request) {
	reference := chi.URLParam(r, "resource_id")
	if len(reference) > 80 || len(r.URL.Query()) != 0 {
		h.fail(w, r, operations.Fail("validation_failed"))
		return
	}
	result, err := h.store.Read(r.Context(), actor(r), operations.Filter{View: "payments", Search: reference, Limit: 1})
	if err != nil {
		h.fail(w, r, err)
		return
	}
	if result.Mode == "disabled" {
		h.fail(w, r, operations.Fail("feature_disabled"))
		return
	}
	if len(result.Payments) == 0 {
		h.fail(w, r, operations.Fail("not_found"))
		return
	}
	httpx.JSON(w, 200, result.Payments[0])
}
func (h *Handler) command(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var c operations.Command
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&c); err != nil {
			h.fail(w, r, operations.Fail("validation_failed"))
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			h.fail(w, r, operations.Fail("validation_failed"))
			return
		}
		c.Kind, c.ResourceID = kind, chi.URLParam(r, "resource_id")
		if kind == "purchase" && c.RentalDays == 0 {
			h.fail(w, r, operations.Fail("invalid_rental_period"))
			return
		}
		if len(c.ResourceID) > 128 {
			h.fail(w, r, operations.Fail("not_found"))
			return
		}
		result, err := h.store.Execute(r.Context(), actor(r), r.Header.Get("Idempotency-Key"), c)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		httpx.JSON(w, 200, result)
	}
}
func (h *Handler) message(w http.ResponseWriter, r *http.Request) {
	result, err := h.store.Message(r.Context(), actor(r), chi.URLParam(r, "resource_id"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, 200, result)
}
func (h *Handler) incoming(w http.ResponseWriter, r *http.Request) {
	timestamp, err := strconv.ParseInt(r.Header.Get("X-NumDock-Timestamp"), 10, 64)
	if err != nil || time.Since(time.Unix(timestamp, 0)).Abs() > 5*time.Minute {
		h.fail(w, r, operations.Fail("unauthenticated"))
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8192))
	if err != nil {
		h.fail(w, r, operations.Fail("validation_failed"))
		return
	}
	signature, err := hex.DecodeString(r.Header.Get("X-NumDock-Signature"))
	mac := hmac.New(sha256.New, h.providerKey)
	mac.Write([]byte(strconv.FormatInt(timestamp, 10) + "."))
	mac.Write(body)
	if err != nil || !hmac.Equal(signature, mac.Sum(nil)) {
		h.fail(w, r, operations.Fail("unauthenticated"))
		return
	}
	var in operations.Incoming
	if err = json.Unmarshal(body, &in); err != nil {
		h.fail(w, r, operations.Fail("validation_failed"))
		return
	}
	in.Raw = body
	state, err := h.store.Ingest(r.Context(), in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, 200, struct {
		Status string `json:"status"`
	}{state})
}
func (h *Handler) stream(w http.ResponseWriter, r *http.Request) {
	if actor(r).KeyID != "" {
		h.fail(w, r, operations.Fail("forbidden"))
		return
	}
	after := int64(0)
	if raw := r.Header.Get("Last-Event-ID"); raw != "" {
		v, e := strconv.ParseInt(raw, 10, 64)
		if e != nil || v < 0 {
			h.fail(w, r, operations.Fail("validation_failed"))
			return
		}
		after = v
	}
	events, err := h.store.Events(r.Context(), actor(r), after)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("X-Accel-Buffering", "no")
	controller := http.NewResponseController(w)
	_, _ = fmt.Fprint(w, "retry: 2000\n\n")
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	deadline := time.NewTimer(10 * time.Second)
	defer deadline.Stop()
	for {
		for _, event := range events {
			data, _ := json.Marshal(event)
			if _, err = fmt.Fprintf(w, "id: %d\ndata: %s\n\n", event.ID, data); err != nil {
				return
			}
			after = event.ID
		}
		if err = controller.Flush(); err != nil {
			return
		}
		select {
		case <-r.Context().Done():
			return
		case <-deadline.C:
			return
		case <-ticker.C:
			events, err = h.store.Events(r.Context(), actor(r), after)
			if err != nil {
				return
			}
			if len(events) == 0 {
				_, _ = fmt.Fprint(w, ": heartbeat\n\n")
			}
		}
	}
}
func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	// Client disconnects and request deadlines are expected during SSE,
	// navigation, and cache invalidation. Do not turn them into noisy 500s.
	if errors.Is(err, context.Canceled) {
		return
	}
	if errors.Is(err, context.DeadlineExceeded) {
		httpx.Fail(w, r, http.StatusGatewayTimeout, "request_timeout", "The request took too long.")
		return
	}
	var domain *operations.Error
	code, status := "internal_error", 500
	if errors.As(err, &domain) {
		code = domain.Code
		status = 400
		switch code {
		case "not_found":
			status = 404
		case "unauthenticated":
			status = 401
		case "forbidden", "feature_disabled":
			status = 403
		case "idempotency_conflict", "inventory_unavailable", "insufficient_balance", "lease_inactive", "refund_unavailable", "release_required":
			status = 409
		case "rate_limited":
			status = 429
		}
	} else {
		h.logger.ErrorContext(r.Context(), "workspace operation failed", "request_id", httpx.RequestID(r.Context()))
	}
	if status == 429 {
		w.Header().Set("Retry-After", "60")
	}
	httpx.Fail(w, r, status, code, "The workspace request could not be completed.")
}
