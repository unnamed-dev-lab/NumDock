package devseed

import (
	"context"
	"fmt"
	"numdock/backend/internal/operations"
)

// Operations uses the same transactional use cases as the UI. Stable idempotency keys
// mean rerunning seed neither credits again nor recreates released resources.
func Operations(ctx context.Context, s operations.Store) error {
	for index, entry := range []struct{ org, user string }{{WorkspaceID, "d1000000-0000-4000-8000-000000000001"}, {IsolatedWorkspaceID, "d1000000-0000-4000-8000-000000000004"}} {
		a := operations.Actor{UserID: entry.user, OrganizationID: entry.org}
		if _, err := s.Execute(ctx, a, "seed-wallet-v1", operations.Command{Kind: "credit", AmountMinor: 25000}); err != nil {
			return err
		}
		count := 3
		if index == 1 {
			count = 1
		}
		for n := 0; n < count; n++ {
			item := n + index*12
			result, err := s.Execute(ctx, a, fmt.Sprintf("seed-purchase-v1-%d", n), operations.Command{Kind: "purchase", CatalogItemID: fmt.Sprintf("d2000000-0000-4000-8000-%012d", item+1), Purpose: "customer_support", ConfirmedTerms: true})
			if err != nil {
				return err
			}
			if result.Number == nil {
				return fmt.Errorf("seed lease missing")
			}
			if item%3 == 1 {
				continue
			}
			for m, body := range []string{"[Mock] Support ticket ND-1042 has been assigned to your team.", "[Mock] Your product notification test was delivered to this development inbox."} {
				if _, err = s.Execute(ctx, a, fmt.Sprintf("seed-message-v1-%d-%d", n, m), operations.Command{Kind: "simulate", LeaseID: result.Number.ID, Body: body}); err != nil {
					return err
				}
			}
		}
		if err := developerSamples(ctx, s, a); err != nil {
			return err
		}
	}
	return nil
}

// Developer examples contain random read-only token hashes, never reusable default
// credentials. Secrets are deliberately discarded; create a new key in the UI to use it.
func developerSamples(ctx context.Context, s operations.Store, a operations.Actor) error {
	if _, err := s.Execute(ctx, a, "seed-key-reader-v1", operations.Command{Kind: "create_key", Name: "Read-only development sample (Mock)", Scopes: []string{"numbers:read", "messages:read", "billing:read"}, ExpiresDays: 30}); err != nil {
		return err
	}
	revoked, err := s.Execute(ctx, a, "seed-key-revoked-v1", operations.Command{Kind: "create_key", Name: "Revoked development sample (Mock)", Scopes: []string{"numbers:read"}, ExpiresDays: 30})
	if err != nil {
		return err
	}
	if _, err = s.Execute(ctx, a, "seed-key-revoke-v1", operations.Command{Kind: "revoke_key", ResourceID: revoked.ID}); err != nil {
		return err
	}
	success, err := s.Execute(ctx, a, "seed-webhook-v1", operations.Command{Kind: "create_webhook", URL: "mock://success"})
	if err != nil {
		return err
	}
	failure, err := s.Execute(ctx, a, "seed-webhook-failure-v1", operations.Command{Kind: "create_webhook", URL: "mock://failure"})
	if err != nil {
		return err
	}
	disabled, err := s.Execute(ctx, a, "seed-webhook-disabled-v1", operations.Command{Kind: "create_webhook", URL: "mock://success"})
	if err != nil {
		return err
	}
	if _, err = s.Execute(ctx, a, "seed-webhook-disable-v1", operations.Command{Kind: "toggle_webhook", ResourceID: disabled.ID, Enabled: false}); err != nil {
		return err
	}
	for _, example := range []struct{ key, id string }{{"seed-delivery-success-v1", success.ID}, {"seed-delivery-failure-v1", failure.ID}} {
		if _, err = s.Execute(ctx, a, example.key, operations.Command{Kind: "test_webhook", ResourceID: example.id}); err != nil {
			return err
		}
	}
	return nil
}
