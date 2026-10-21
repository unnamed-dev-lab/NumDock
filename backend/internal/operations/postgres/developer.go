package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"numdock/backend/internal/operations"
	db "numdock/backend/internal/operations/postgres/db"
	"numdock/backend/internal/platform/safehttp"
	"strings"
	"time"
	"unicode/utf8"
)

func (s *Store) developer(ctx context.Context, tx pgx.Tx, q *db.Queries, a operations.Actor, c operations.Command) (operations.Result, error) {
	switch c.Kind {
	case "create_key":
		c.Name = strings.TrimSpace(c.Name)
		if c.Name == "" || utf8.RuneCountInString(c.Name) > 80 || len(c.Scopes) == 0 || len(c.Scopes) > 4 {
			return operations.Result{}, operations.Fail("validation_failed")
		}
		for _, scope := range c.Scopes {
			if !contains([]string{"numbers:read", "numbers:write", "messages:read", "billing:read"}, scope) {
				return operations.Result{}, operations.Fail("validation_failed")
			}
		}
		if c.ExpiresDays == 0 {
			c.ExpiresDays = 30
		}
		if c.ExpiresDays < 1 || c.ExpiresDays > 90 {
			return operations.Result{}, operations.Fail("validation_failed")
		}
		if err := q.LockOperation(ctx, "resource-limit:"+a.OrganizationID+":keys"); err != nil {
			return operations.Result{}, err
		}
		count, err := q.CountAPIKeys(ctx, a.OrganizationID)
		if err != nil {
			return operations.Result{}, err
		}
		if count >= 100 {
			return operations.Result{}, operations.Fail("resource_limit")
		}
		raw, err := token("nd_mock_")
		if err != nil {
			return operations.Result{}, err
		}
		row, err := q.CreateAPIKey(ctx, db.CreateAPIKeyParams{OrganizationID: a.OrganizationID, UserID: a.UserID, Name: c.Name, Prefix: raw[:16], TokenHash: hash(raw), Scopes: c.Scopes, ExpiresAt: date(time.Now().Add(time.Duration(c.ExpiresDays) * 24 * time.Hour))})
		if err != nil {
			return operations.Result{}, err
		}
		key := operations.APIKey{ID: row.ID, Name: row.Name, Prefix: row.Prefix, Scopes: row.Scopes, CreatedAt: row.CreatedAt.Time, ExpiresAt: row.ExpiresAt.Time}
		return operations.Result{ID: row.ID, Status: "active", Secret: raw, Key: &key}, nil
	case "revoke_key":
		n, err := q.RevokeAPIKey(ctx, db.RevokeAPIKeyParams{ID: c.ResourceID, OrganizationID: a.OrganizationID})
		if err != nil {
			return operations.Result{}, err
		}
		if n == 0 {
			return operations.Result{}, operations.Fail("not_found")
		}
		return operations.Result{ID: c.ResourceID, Status: "revoked"}, nil
	case "create_webhook":
		if err := safehttp.Validate(c.URL); err != nil {
			return operations.Result{}, operations.Fail("invalid_webhook_url")
		}
		if err := q.LockOperation(ctx, "resource-limit:"+a.OrganizationID+":webhooks"); err != nil {
			return operations.Result{}, err
		}
		count, err := q.CountWebhooks(ctx, a.OrganizationID)
		if err != nil {
			return operations.Result{}, err
		}
		if count >= 10 {
			return operations.Result{}, operations.Fail("resource_limit")
		}
		id, err := q.NewIdentifier(ctx)
		if err != nil {
			return operations.Result{}, err
		}
		secret, err := token("whsec_")
		if err != nil {
			return operations.Result{}, err
		}
		encrypted, err := s.seal([]byte(secret), a.OrganizationID+":"+id)
		if err != nil {
			return operations.Result{}, err
		}
		row, err := q.CreateWebhook(ctx, db.CreateWebhookParams{ID: id, OrganizationID: a.OrganizationID, Url: c.URL, SecretCiphertext: encrypted})
		if err != nil {
			return operations.Result{}, err
		}
		hook := operations.Webhook{ID: row.ID, URL: row.Url, Enabled: row.Enabled, CreatedAt: row.CreatedAt.Time}
		return operations.Result{ID: id, Status: "enabled", Secret: secret, Webhook: &hook}, nil
	case "toggle_webhook":
		n, err := q.SetWebhookEnabled(ctx, db.SetWebhookEnabledParams{ID: c.ResourceID, OrganizationID: a.OrganizationID, Enabled: c.Enabled})
		if err != nil {
			return operations.Result{}, err
		}
		if n == 0 {
			return operations.Result{}, operations.Fail("not_found")
		}
		state := "disabled"
		if c.Enabled {
			state = "enabled"
		}
		return operations.Result{ID: c.ResourceID, Status: state}, nil
	case "test_webhook":
		hook, err := q.GetWebhook(ctx, db.GetWebhookParams{ID: c.ResourceID, OrganizationID: a.OrganizationID})
		if errors.Is(err, pgx.ErrNoRows) {
			return operations.Result{}, operations.Fail("not_found")
		}
		if err != nil {
			return operations.Result{}, err
		}
		if !hook.Enabled {
			return operations.Result{}, operations.Fail("webhook_disabled")
		}
		event, err := q.EmitEvent(ctx, db.EmitEventParams{OrganizationID: a.OrganizationID, Type: "webhook.test", ResourceID: hook.ID})
		if err != nil {
			return operations.Result{}, err
		}
		id, err := q.CreateDelivery(ctx, db.CreateDeliveryParams{OrganizationID: a.OrganizationID, EndpointID: hook.ID, EventID: event})
		if err != nil {
			return operations.Result{}, err
		}
		err = s.queue(ctx, tx, "deliver", id, time.Now())
		return operations.Result{ID: id, Status: "pending"}, err
	}
	return operations.Result{}, operations.Fail("validation_failed")
}
func (s *Store) Authenticate(ctx context.Context, raw string) (operations.Actor, error) {
	if !s.development || !strings.HasPrefix(raw, "nd_mock_") || len(raw) > 100 {
		return operations.Actor{}, operations.Fail("unauthenticated")
	}
	row, err := db.New(s.Pool).AuthenticateAPIKey(ctx, hash(raw))
	if errors.Is(err, pgx.ErrNoRows) {
		return operations.Actor{}, operations.Fail("unauthenticated")
	}
	if err != nil {
		return operations.Actor{}, err
	}
	return operations.Actor{UserID: row.UserID, OrganizationID: row.OrganizationID, KeyID: row.ID, Scopes: row.Scopes}, nil
}
