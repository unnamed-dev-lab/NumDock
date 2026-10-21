package httpapi

import (
	"context"
	"errors"
	"github.com/go-chi/chi/v5"
	"log/slog"
	"net/http"
	identityhttp "numdock/backend/internal/identity/httpapi"
	"numdock/backend/internal/overview"
	"numdock/backend/internal/platform/httpx"
	"time"
)

type Handler struct {
	service *overview.Service
	logger  *slog.Logger
}

func New(service *overview.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}
func (h *Handler) Routes(r chi.Router, authenticate func(http.Handler) http.Handler) {
	r.With(authenticate).Get("/organizations/{organization_id}/overview", h.get)
}
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	user, ok := identityhttp.UserFromContext(r.Context())
	if !ok {
		httpx.Fail(w, r, 401, "unauthenticated", "Sign in to continue.")
		return
	}
	days := 30
	q := r.URL.Query()
	for k, v := range q {
		if k != "days" || len(v) != 1 {
			httpx.Fail(w, r, 400, "validation_failed", "Only one days parameter is allowed.")
			return
		}
	}
	if q.Has("days") {
		switch q.Get("days") {
		case "7":
			days = 7
		case "30":
			days = 30
		default:
			httpx.Fail(w, r, 400, "validation_failed", "Days must be 7 or 30.")
			return
		}
	}
	result, err := h.service.Get(r.Context(), user.ID, chi.URLParam(r, "organization_id"), days, time.Now())
	if errors.Is(err, overview.ErrNotFound) {
		httpx.Fail(w, r, 404, "not_found", "Organization not found.")
		return
	}
	if errors.Is(err, context.Canceled) {
		return
	}
	if errors.Is(err, context.DeadlineExceeded) {
		httpx.Fail(w, r, 504, "request_timeout", "The request took too long.")
		return
	}
	if err != nil {
		h.logger.ErrorContext(r.Context(), "overview query failed", "request_id", httpx.RequestID(r.Context()))
		httpx.Fail(w, r, 500, "internal_error", "We could not load the overview.")
		return
	}
	httpx.JSON(w, 200, result)
}
