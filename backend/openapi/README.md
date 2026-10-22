# NumDock API documentation

This directory is the documentation entry point for the NumDock HTTP API.

- **OpenAPI contract:** [`openapi.yaml`](openapi.yaml)
- **Served contract:** `GET /v1/openapi.yaml` from the Go API
- **Endpoint reference:** [`identity.md`](identity.md)
- **Error reference:** [`errors.md`](errors.md)
- **Local testing:** [`testing.md`](testing.md)

The OpenAPI file is the single source of truth. The TypeScript client is generated
from it. Product pages no longer expose an interactive developer reference.
Resource endpoint migration details are in [resources.md](resources.md).

## Current scope

The API contains identity and an explicitly marked development catalog:

| Category | Endpoints | Status |
| --- | --- | --- |
| Health | `GET /healthz`, `GET /readyz` | Implemented |
| Documentation | `GET /v1/openapi.yaml` | Implemented |
| Identity | `GET /v1/auth/csrf`, `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/me` | Implemented |
| Organizations | `GET /v1/organizations` | Implemented |
| Overview | `GET /v1/organizations/{organization_id}/overview` | Organization-authorized development summaries, empty/disabled elsewhere |
| Catalog | `GET /v1/catalog/numbers` | Read-only PostgreSQL mock catalog in development; disabled elsewhere |
| Account resources | /summary, /numbers, /messages, /orders, /billing/wallet, /billing/ledger, /billing/payments and /events/stream under the account prefix | Separate authenticated resources |
| Provider ingress | `POST /v1/providers/mock/webhook` | Signed, deduplicated and lease-authorized development messages |

Development records are marked Mock and disabled in production. The catalog lists only available numbers. Development wallets, leases, messages and payment orders are persisted; no real carrier or payment is connected. See [Mock workspace](../../docs/mock-workspace.md) for business rules, idempotency, payment rules and incoming message signatures.

## Base URLs

| Environment | Base URL |
| --- | --- |
| Local frontend proxy | `http://localhost:3000` |
| Direct local API | `http://127.0.0.1:8080` |
| Production | Same origin as the deployed frontend/reverse proxy |

All browser requests in this project are same-origin. There is no CORS
configuration and no cross-origin cookie deployment.

## Authentication flow

NumDock uses an HttpOnly session cookie plus a CSRF double-submit token.

1. Call `GET /v1/auth/csrf`.
2. The API sets an HttpOnly CSRF cookie and returns the same token in JSON.
3. Send the token in `X-CSRF-Token` and send an `Origin` header that exactly
   matches `APP_ORIGIN`.
4. Call `POST /v1/auth/register` or `POST /v1/auth/login`.
5. The API sets the session cookie. Browser requests must include credentials.
6. Call `GET /v1/me` or `GET /v1/organizations` with the session cookie.
7. Call `POST /v1/auth/logout` with the session cookie, CSRF token, and Origin.

Cookie names:

| Mode | CSRF cookie | Session cookie |
| --- | --- | --- |
| Local HTTP (`COOKIE_SECURE=false`) | `numdock_csrf` | `numdock_session` |
| Secure deployment (`COOKIE_SECURE=true`) | `__Host-numdock_csrf` | `__Host-numdock_session` |

Sessions last 12 hours. Only a SHA-256 digest of the session token is stored in
PostgreSQL. Login rotates the presented session cookie and revokes the old
session.

## Common conventions

### Error envelope

Every failure uses the same JSON shape:

```json
{
  "code": "validation_failed",
  "message": "Enter a valid email address.",
  "request_id": "3d4f6a9b2c1e4f67890a1b"
}
```

Use `code` for control flow and translations. Do not parse `message` or match
English text.

### Request IDs

The server generates `X-Request-ID` and repeats it in error envelopes. The
value is generated server-side; client-supplied `X-Request-ID` values are
ignored. Include this ID when reporting an API problem. Do not include
passwords, session tokens, CSRF tokens, or message content in reports.

### Caching

API responses use `Cache-Control: no-store`. Do not cache authenticated
responses in a shared cache.

### Pagination

List endpoints use `limit` and `offset` query parameters. The current
organization list accepts `limit=1..100` (default 20) and a non-negative
`offset` (default 0).

### Rate limits

Authentication endpoints are limited per client IP and per normalized email
using persistent PostgreSQL counters:

- 20 attempts per IP per minute.
- 10 attempts per email per minute.

A `429` response includes `Retry-After: 60`. The API trusts
`X-Forwarded-For` only when the immediate peer is listed in
`TRUSTED_PROXIES`; otherwise it uses the direct connection address.

### Request timeouts

Requests are cancelled after 15 seconds. The API returns `504
request_timeout` when a handler observes the timeout. If a response has
already started, it is not overwritten.

## Generating a TypeScript SDK with Hey API

The contract is intentionally strict enough for client generation: every
operation has an `operationId`, explicit response statuses, typed request and
response bodies, a stable `ErrorCode` union, and required CSRF header
parameters. Operations that use the cookie session also declare the `Session`
security scheme.

Generate into a separate folder (this does not add a dependency to the
application):

```bash
pnpm dlx --package=@hey-api/openapi-ts@0.99.0 --package=typescript@5.9.3 \
  openapi-ts \
  -i backend/openapi/openapi.yaml \
  -o frontend/app/lib/api/heyapi \
  -c @hey-api/client-fetch
```

The generated SDK was checked with `tsc --noEmit` using strict TypeScript
5.9.3. For a browser client, include cookies and point the base URL at the
same origin:

```ts
import { client } from "./heyapi/client.gen";
import { getCsrfToken, register } from "./heyapi/sdk.gen";

client.setConfig({
  baseUrl: window.location.origin,
  credentials: "include",
});

const { data: csrf } = await getCsrfToken({ throwOnError: true });
await register({
  body: {
    email: "alex@example.com",
    password: "a sufficiently long passphrase",
    name: "Alex",
    organization_name: "Alpha",
  },
  headers: {
    "X-CSRF-Token": csrf.token,
  },
  throwOnError: true,
});
```

`Origin` is optional in the generated types because browsers set it
automatically; non-browser clients must provide it explicitly. Do not store
the session token or CSRF token in localStorage.

## Related source

- Contract tests: `backend/internal/server/integration_test.go`,
  `backend/internal/server/error_paths_test.go`
- OpenAPI validation: contract responses are validated by
  `assertContract` in the integration tests.

## Overview and telemetry

The overview endpoint accepts `days=7` or `30`, returns UTC daily samples and integer USD cents, checks membership and hides fixtures outside development. Telemetry configuration flags are not collector health. See [overview and observability](../../docs/observability.md). When HTTP instrumentation is enabled, `X-Trace-ID` correlates responses with request logs. Request bodies, credentials and query strings are excluded from telemetry.

## Public feature status

`GET /v1/status` is unauthenticated and returns aggregate API/database readiness, configured feature modes (`active`, `mock`, `disabled`, `unavailable`) and live provider/payment connection flags. It contains no tenant data or operational diagnostics. HTTP 200 means the status report was read; inspect dependency fields for readiness. Mock is enabled only in development. Responses are not cached by HTTP intermediaries.


个人账户充值流程见 [Development payments](payments.md)：支付订单创建、确认、取消、历史查询以及幂等入账。组织路径参数仅保留为内部授权边界，普通注册不再要求组织名称。
