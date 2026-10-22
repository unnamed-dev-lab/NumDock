# API hooks

All TanStack Query hooks, query options, keys, retry policies and invalidation live here.
Components consume hooks; root.tsx only owns the request-scoped QueryClient provider.
ESLint enforces this boundary.

- auth.ts: identity, register/login and logout; session tokens remain HttpOnly cookies.
- catalog.ts: public number catalog and SSR initial data.
- resources.ts: typed numbers/messages/orders/ledger/payments lists and account summary.
- billing.ts: payment detail, including pending-order polling.
- messages.ts: private message detail and cache cleanup on close.
- overview.ts: period queries, placeholder data and prefetch.
- commands.ts: customer writes and idempotent mutation cache effects.
- keys.ts / policy.ts / cache.ts / events.ts: shared keys, retry policy and targeted SSE invalidation.

Transport types come from the generated OpenAPI schema. Component-local form and display
state stays near the UI. Account identity is included in every private query key.
Server loaders use app/lib/api/server; browser components consume hooks rather than the
transport client directly.
