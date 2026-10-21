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
		if raw := r.Header.Get("Authorization"); raw != "" {
			if !strings.HasPrefix(raw, "Bearer ") {
				h.fail(w, r, operations.Fail("unauthenticated"))
				return
			}
			a, err := h.store.Authenticate(r.Context(), strings.TrimPrefix(raw, "Bearer "))
			if err != nil {
				h.fail(w, r, err)
				return
			}
			if a.OrganizationID != org {
				h.fail(w, r, operations.Fail("not_found"))
				return
			}
			proceed(a)
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
func permitted(a operations.Actor, scope string) bool {
	if a.KeyID == "" {
		return true
	}
	if scope == "" {
		return false
	}
	for _, v := range a.Scopes {
		if v == scope {
			return true
		}
	}
	return false
}
func (h *Handler) Routes(r chi.Router) {
	r.Post("/providers/mock/webhook", h.incoming)
	r.Route("/organizations/{organization_id}", func(r chi.Router) {
		r.Use(h.auth)
		r.Get("/workspace", h.read)
		r.Get("/messages/{resource_id}", h.message)
		r.Get("/events/stream", h.stream)
		routes := []struct{ method, path, kind, scope string }{{"POST", "/billing/mock-credit", "credit", ""}, {"POST", "/orders", "purchase", "numbers:write"}, {"POST", "/leases/{resource_id}/release", "release", "numbers:write"}, {"POST", "/orders/{resource_id}/refund", "refund", ""}, {"POST", "/messages/simulate", "simulate", ""}, {"DELETE", "/messages/{resource_id}", "delete_message", ""}, {"POST", "/api-keys", "create_key", ""}, {"POST", "/api-keys/{resource_id}/revoke", "revoke_key", ""}, {"POST", "/webhooks", "create_webhook", ""}, {"PATCH", "/webhooks/{resource_id}", "toggle_webhook", ""}, {"POST", "/webhooks/{resource_id}/test", "test_webhook", ""}}
		for _, route := range routes {
			r.MethodFunc(route.method, route.path, h.command(route.kind, route.scope))
		}
	})
}
func (h *Handler) read(w http.ResponseWriter, r *http.Request) {
	f := operations.Filter{View: r.URL.Query().Get("view"), Status: r.URL.Query().Get("status"), Search: r.URL.Query().Get("q"), Limit: 20}
	if f.View == "" {
		f.View = "numbers"
	}
	var err error
	for key, target := range map[string]*int32{"limit": &f.Limit, "offset": &f.Offset} {
		if raw := r.URL.Query().Get(key); raw != "" {
			v, e := strconv.ParseInt(raw, 10, 32)
			if e != nil {
				err = e
			}
			*target = int32(v)
		}
	}
	if err != nil || f.Limit < 1 || f.Limit > 100 || f.Offset < 0 || f.Offset > 100000 || len(f.Search) > 80 {
		h.fail(w, r, operations.Fail("validation_failed"))
		return
	}
	valid := map[string][]string{"numbers": {"", "active", "released", "expired"}, "messages": {"", "read", "unread"}, "orders": {"", "completed", "failed", "refunded"}, "ledger": {""}, "keys": {""}, "webhooks": {""}, "deliveries": {""}}
	statuses, ok := valid[f.View]
	found := false
	for _, s := range statuses {
		found = found || s == f.Status
	}
	if !ok || !found {
		h.fail(w, r, operations.Fail("validation_failed"))
		return
	}
	scope := map[string]string{"numbers": "numbers:read", "orders": "numbers:read", "messages": "messages:read", "ledger": "billing:read"}[f.View]
	if !permitted(actor(r), scope) {
		h.fail(w, r, operations.Fail("forbidden"))
		return
	}
	result, err := h.store.Read(r.Context(), actor(r), f)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, 200, result)
}
func (h *Handler) command(kind, scope string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !permitted(actor(r), scope) {
			h.fail(w, r, operations.Fail("forbidden"))
			return
		}
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
	if !permitted(actor(r), "messages:read") {
		h.fail(w, r, operations.Fail("forbidden"))
		return
	}
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
