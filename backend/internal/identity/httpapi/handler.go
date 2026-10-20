package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"numdock/backend/internal/identity"
	"numdock/backend/internal/platform/httpx"
)

type Handler struct {
	service *identity.Service
	origin  string
	secure  bool
	logger  *slog.Logger
	slots   chan struct{}
}

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Identity struct {
	User          User           `json:"user"`
	Organizations []Organization `json:"organizations"`
}

type credentials struct {
	Email            string `json:"email"`
	Password         string `json:"password"`
	Name             string `json:"name,omitempty"`
	OrganizationName string `json:"organization_name,omitempty"`
}

func New(service *identity.Service, origin string, secure bool, logger *slog.Logger) *Handler {
	return &Handler{service: service, origin: origin, secure: secure, logger: logger, slots: make(chan struct{}, 4)}
}

func (h *Handler) Routes(r chi.Router) {
	r.Get("/auth/csrf", h.csrf)
	r.With(h.protect, h.limit).Post("/auth/register", h.register)
	r.With(h.protect, h.limit).Post("/auth/login", h.login)
	r.With(h.protect).Post("/auth/logout", h.logout)
	r.Get("/me", h.me)
	r.Get("/organizations", h.organizations)
}

func (h *Handler) cookieName(kind string) string {
	if h.secure {
		return "__Host-numdock_" + kind
	}
	return "numdock_" + kind
}

func (h *Handler) setCookie(w http.ResponseWriter, kind, value string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{Name: h.cookieName(kind), Value: value, Path: "/", HttpOnly: true, Secure: h.secure, SameSite: http.SameSiteStrictMode, MaxAge: int(ttl.Seconds()), Expires: time.Now().Add(ttl)})
}

func validToken(token string) bool {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	return err == nil && len(raw) == 32
}

func randomToken() (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(token), nil
}

func (h *Handler) csrf(w http.ResponseWriter, r *http.Request) {
	token := ""
	if cookie, err := r.Cookie(h.cookieName("csrf")); err == nil && validToken(cookie.Value) {
		token = cookie.Value
	}
	if token == "" {
		var err error
		token, err = randomToken()
		if err != nil {
			h.internal(w, r, err)
			return
		}
	}
	h.setCookie(w, "csrf", token, identity.SessionTTL)
	httpx.JSON(w, http.StatusOK, struct {
		Token string `json:"token"`
	}{token})
}

func (h *Handler) protect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(h.cookieName("csrf"))
		token := r.Header.Get("X-CSRF-Token")
		if r.Header.Get("Origin") != h.origin || err != nil || !validToken(token) || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(token)) != 1 {
			httpx.Fail(w, r, http.StatusForbidden, "csrf_failed", "Your security token expired. Refresh and try again.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		key := sha256.Sum256([]byte("ip:" + host))
		// Persistent counters are shared across API replicas. Never trust forwarded IP headers here.
		count, err := h.service.ConsumeAuthLimit(r.Context(), hex.EncodeToString(key[:]))
		if err != nil {
			h.internal(w, r, err)
			return
		}
		if count > 20 {
			h.tooMany(w, r)
			return
		}
		select {
		case h.slots <- struct{}{}:
			defer func() { <-h.slots }()
			next.ServeHTTP(w, r)
		default:
			h.tooMany(w, r)
		}
	})
}

func (h *Handler) tooMany(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Retry-After", "60")
	httpx.Fail(w, r, http.StatusTooManyRequests, "rate_limited", "Too many attempts. Please try again in a minute.")
}

func (h *Handler) readCredentials(w http.ResponseWriter, r *http.Request, registration bool) (credentials, bool) {
	var c credentials
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		httpx.Fail(w, r, 415, "unsupported_media_type", "Send an application/json request.")
		return c, false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var decodeErr error
	if registration {
		decodeErr = decoder.Decode(&c)
	} else {
		var login struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		decodeErr = decoder.Decode(&login)
		c.Email, c.Password = login.Email, login.Password
	}
	if decodeErr != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(decodeErr, &maxBytesErr) {
			httpx.Fail(w, r, http.StatusRequestEntityTooLarge, "payload_too_large", "Request body is too large.")
			return c, false
		}
		httpx.Fail(w, r, 400, "invalid_request", "Enter valid account details.")
		return c, false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			httpx.Fail(w, r, http.StatusRequestEntityTooLarge, "payload_too_large", "Request body is too large.")
			return c, false
		}
		httpx.Fail(w, r, 400, "invalid_request", "Only one JSON object is allowed.")
		return c, false
	}
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
	parsed, err := mail.ParseAddress(c.Email)
	if err != nil || parsed.Address != c.Email || len(c.Email) > 254 {
		httpx.Fail(w, r, 400, "validation_failed", "Enter a valid email address.")
		return c, false
	}
	if err := identity.ValidatePassword(c.Password); err != nil {
		httpx.Fail(w, r, 400, "validation_failed", "Use a password between 12 and 128 characters.")
		return c, false
	}
	c.Name, c.OrganizationName = strings.TrimSpace(c.Name), strings.TrimSpace(c.OrganizationName)
	if registration && (utf8.RuneCountInString(c.Name) < 1 || utf8.RuneCountInString(c.Name) > 100 || utf8.RuneCountInString(c.OrganizationName) < 1 || utf8.RuneCountInString(c.OrganizationName) > 100) {
		httpx.Fail(w, r, 400, "validation_failed", "Name and workspace name must each contain 1–100 characters.")
		return c, false
	}
	key := sha256.Sum256([]byte("email:" + c.Email))
	count, err := h.service.ConsumeAuthLimit(r.Context(), hex.EncodeToString(key[:]))
	if err != nil {
		h.internal(w, r, err)
		return c, false
	}
	if count > 10 {
		h.tooMany(w, r)
		return c, false
	}
	return c, true
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	c, ok := h.readCredentials(w, r, true)
	if !ok {
		return
	}
	result, token, err := h.service.Register(r.Context(), identity.RegisterInput{
		Email:            c.Email,
		Password:         c.Password,
		Name:             c.Name,
		OrganizationName: c.OrganizationName,
	})
	if errors.Is(err, identity.ErrEmailTaken) {
		httpx.Fail(w, r, 409, "account_unavailable", "Unable to create this account. Try signing in instead.")
		return
	}
	if errors.Is(err, identity.ErrPasswordLength) {
		httpx.Fail(w, r, 400, "validation_failed", "Use a password between 12 and 128 characters.")
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	h.setCookie(w, "session", token, identity.SessionTTL)
	httpx.JSON(w, http.StatusCreated, mapIdentity(result))
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	c, ok := h.readCredentials(w, r, false)
	if !ok {
		return
	}
	oldToken := ""
	if cookie, err := r.Cookie(h.cookieName("session")); err == nil {
		oldToken = cookie.Value
	}
	result, token, err := h.service.Login(r.Context(), c.Email, c.Password, oldToken)
	if errors.Is(err, identity.ErrInvalidCredentials) {
		httpx.Fail(w, r, 401, "invalid_credentials", "Email or password is incorrect.")
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	h.setCookie(w, "session", token, identity.SessionTTL)
	httpx.JSON(w, 200, mapIdentity(result))
}

func (h *Handler) currentUser(w http.ResponseWriter, r *http.Request) (identity.User, bool) {
	cookie, err := r.Cookie(h.cookieName("session"))
	if err != nil || !validToken(cookie.Value) {
		httpx.Fail(w, r, 401, "unauthenticated", "Sign in to continue.")
		return identity.User{}, false
	}
	user, err := h.service.CurrentUser(r.Context(), cookie.Value)
	if errors.Is(err, identity.ErrUnauthenticated) {
		httpx.Fail(w, r, 401, "unauthenticated", "Your session expired. Please sign in again.")
		return identity.User{}, false
	}
	if err != nil {
		h.internal(w, r, err)
		return identity.User{}, false
	}
	return user, true
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	user, ok := h.currentUser(w, r)
	if !ok {
		return
	}
	result, err := h.service.Identity(r.Context(), user)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	httpx.JSON(w, 200, mapIdentity(result))
}

func (h *Handler) organizations(w http.ResponseWriter, r *http.Request) {
	user, ok := h.currentUser(w, r)
	if !ok {
		return
	}
	limit, offset := int64(20), int64(0)
	var err error
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.ParseInt(raw, 10, 32)
	}
	if err != nil || limit < 1 || limit > 100 {
		httpx.Fail(w, r, 400, "validation_failed", "Limit must be between 1 and 100.")
		return
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		offset, err = strconv.ParseInt(raw, 10, 32)
	}
	if err != nil || offset < 0 {
		httpx.Fail(w, r, 400, "validation_failed", "Offset must be a non-negative integer.")
		return
	}
	items, err := h.service.Organizations(r.Context(), user.ID, int32(limit), int32(offset))
	if err != nil {
		h.internal(w, r, err)
		return
	}
	organizations := make([]Organization, 0, len(items))
	for _, item := range items {
		organizations = append(organizations, Organization{
			ID:        item.ID,
			Name:      item.Name,
			Role:      item.Role,
			CreatedAt: item.CreatedAt,
		})
	}
	httpx.JSON(w, 200, struct {
		Items  []Organization `json:"items"`
		Limit  int64          `json:"limit"`
		Offset int64          `json:"offset"`
	}{organizations, limit, offset})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.currentUser(w, r); !ok {
		return
	}
	cookie, _ := r.Cookie(h.cookieName("session"))
	if err := h.service.Logout(r.Context(), cookie.Value); err != nil {
		h.internal(w, r, err)
		return
	}
	h.setCookie(w, "session", "", -time.Second)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) internal(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		h.logger.WarnContext(r.Context(), "identity request timed out",
			"error_type", errorType(err),
			"request_id", httpx.RequestID(r.Context()),
		)
		httpx.Fail(w, r, http.StatusGatewayTimeout, "request_timeout", "The request took too long. Please try again.")
		return
	case errors.Is(err, context.Canceled):
		// The client is gone; writing a response is pointless and can race with
		// the connection being closed.
		h.logger.InfoContext(r.Context(), "identity request canceled",
			"error_type", errorType(err),
			"request_id", httpx.RequestID(r.Context()),
		)
		return
	}
	// Database errors can contain submitted values. Log only their type, never their text.
	h.logger.ErrorContext(r.Context(), "identity request failed",
		"error_type", errorType(err),
		"request_id", httpx.RequestID(r.Context()),
	)
	httpx.Fail(w, r, 500, "internal_error", "We could not complete this request. Please try again.")
}

func errorType(err error) string {
	if errors.Is(err, context.DeadlineExceeded) {
		return "deadline_exceeded"
	}
	if errors.Is(err, context.Canceled) {
		return "canceled"
	}
	var storeErr *identity.StoreError
	if errors.As(err, &storeErr) {
		if storeErr.Code != "" {
			return "database_" + storeErr.Code
		}
		return "database"
	}
	return "internal"
}

func mapIdentity(value identity.Identity) Identity {
	organizations := make([]Organization, 0, len(value.Organizations))
	for _, organization := range value.Organizations {
		organizations = append(organizations, Organization{
			ID:        organization.ID,
			Name:      organization.Name,
			Role:      organization.Role,
			CreatedAt: organization.CreatedAt,
		})
	}
	return Identity{
		User: User{
			ID:        value.User.ID,
			Email:     value.User.Email,
			Name:      value.User.Name,
			CreatedAt: value.User.CreatedAt,
		},
		Organizations: organizations,
	}
}
