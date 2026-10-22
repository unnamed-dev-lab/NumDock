# Development payments

The customer flow is now: create a payment order, review its stored amount, confirm payment, credit the wallet exactly once. Creating or viewing an order does not change the balance.

- POST /v1/organizations/{organization_id}/billing/payments — body amount_minor (USD cents, 100–1000000). Creates pending checkout, expires after 15 minutes; at most 10 unexpired pending orders per account.
- POST /v1/organizations/{organization_id}/billing/payments/{resource_id}/confirm — body {}. The development gateway completes the order. simulate_failure=true exercises failure in tests. Client-supplied amount is never used at settlement.
- POST /v1/organizations/{organization_id}/billing/payments/{resource_id}/cancel — body {}. Cancels a pending order.
- GET /v1/organizations/{organization_id}/billing/payments — paginated history; status filters pending/succeeded/failed/canceled/expired, exact reference search via q.

All writes require a browser session, owner/admin permission, Origin, CSRF and Idempotency-Key. API keys and their authentication endpoints have been removed. Orders and balances remain scoped to the authenticated account's internal ownership boundary. The UI does not expose organization management; new registrations default that boundary's name to the account name, while legacy organization_name requests remain compatible.

Order states are terminal after success, failure, cancellation or expiry. Replaying or concurrently confirming an already succeeded order cannot credit it twice, including when different idempotency keys are used. Wallet locking, the payment row lock, the terminal transition, the immutable payment_credit ledger entry, audit and SSE events share one PostgreSQL transaction. Duplicate creation with the same key returns the original order. Changed requests with the same key conflict.

River persists expiration jobs. Confirmation also checks the deadline, and reads display expired orders correctly even if the worker has been offline. Refreshing the checkout restores its database state using its public-facing PAY reference; it never infers success from URL parameters.

This implementation is an authenticated development gateway, not a live payment integration. It accepts no real card details and never charges real money. Production disables these writes. Real checkout redirects, provider-signed callbacks, reconciliation and external payment refunds must be implemented against a selected approved payment provider before live use. The old mock-credit HTTP endpoint has been removed; only the internal development seed uses direct fixture credit.

See [OpenAPI](openapi.yaml) for the generated-client contract and [Mock workspace](../../docs/mock-workspace.md) for number purchase/refund behavior.
