package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"numdock/backend/internal/catalog"
	"numdock/backend/internal/platform/httpx"
)

type Handler struct {
	service *catalog.Service
	logger  *slog.Logger
}

func New(service *catalog.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) Routes(r chi.Router) {
	r.Get("/catalog/numbers", h.list)
}

func parseFilter(q url.Values) (catalog.Filter, error) {
	f := catalog.Filter{Country: q.Get("country"), NumberType: q.Get("number_type"), Capability: q.Get("capability"), UseCase: q.Get("use_case"), Search: strings.TrimSpace(q.Get("q")), SortBy: "e164", SortOrder: "asc", Limit: 20}
	allowed := map[string]bool{"country": true, "number_type": true, "capability": true, "use_case": true, "q": true, "sort": true, "order": true, "limit": true, "offset": true}
	for key, values := range q {
		if !allowed[key] || len(values) != 1 {
			return f, errors.New("unknown or repeated query parameter")
		}
	}
	for _, key := range []string{"country", "number_type", "capability", "use_case"} {
		if q.Has(key) && q.Get(key) == "" {
			return f, errors.New("filter values must not be empty")
		}
	}
	if f.Country != "" && (len(f.Country) != 2 || f.Country[0] < 'A' || f.Country[0] > 'Z' || f.Country[1] < 'A' || f.Country[1] > 'Z') {
		return f, errors.New("country must be a two-letter uppercase code")
	}
	if f.NumberType != "" && f.NumberType != "local" && f.NumberType != "mobile" && f.NumberType != "toll_free" {
		return f, errors.New("invalid number type")
	}
	if f.Capability != "" && f.Capability != "sms" && f.Capability != "voice" && f.Capability != "mms" {
		return f, errors.New("invalid capability")
	}
	if f.UseCase != "" && !catalog.IsUseCase(f.UseCase) {
		return f, errors.New("invalid use case")
	}
	if !utf8.ValidString(f.Search) || utf8.RuneCountInString(f.Search) > 100 {
		return f, errors.New("search must contain at most 100 characters")
	}
	if q.Has("sort") {
		f.SortBy = q.Get("sort")
	}
	if f.SortBy != "e164" && f.SortBy != "monthly_fee_minor" && f.SortBy != "inbound_sms_fee_micros" {
		return f, errors.New("invalid sort field")
	}
	if q.Has("order") {
		f.SortOrder = q.Get("order")
	}
	if f.SortOrder != "asc" && f.SortOrder != "desc" {
		return f, errors.New("invalid sort order")
	}
	if q.Has("limit") {
		n, err := strconv.ParseInt(q.Get("limit"), 10, 32)
		if err != nil || n < 1 || n > 100 {
			return f, errors.New("limit must be between 1 and 100")
		}
		f.Limit = int32(n)
	}
	if q.Has("offset") {
		n, err := strconv.ParseInt(q.Get("offset"), 10, 32)
		if err != nil || n < 0 {
			return f, errors.New("offset must be a non-negative 32-bit integer")
		}
		f.Offset = int32(n)
	}
	return f, nil
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilter(r.URL.Query())
	if err != nil {
		httpx.Fail(w, r, 400, "validation_failed", err.Error())
		return
	}
	result, err := h.service.List(r.Context(), f)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		if errors.Is(err, context.DeadlineExceeded) {
			httpx.Fail(w, r, 504, "request_timeout", "The request took too long.")
			return
		}
		h.logger.ErrorContext(r.Context(), "catalog query failed", "request_id", httpx.RequestID(r.Context()))
		httpx.Fail(w, r, 500, "internal_error", "We could not load the catalog.")
		return
	}
	httpx.JSON(w, 200, result)
}
