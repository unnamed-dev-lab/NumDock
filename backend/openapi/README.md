# NumDock API documentation

This directory is the documentation entry point for the NumDock HTTP API.

- **OpenAPI contract:** [`openapi.yaml`](openapi.yaml)
- **Interactive reference:** `/docs/api` when the frontend is running
- **Served contract:** `GET /v1/openapi.yaml` from the Go API
- **Endpoint reference:** [`identity.md`](identity.md)
- **Error reference:** [`errors.md`](errors.md)
- **Local testing:** [`testing.md`](testing.md)

The OpenAPI file is the single source of truth. Scalar derives the sidebar,
operation summaries and descriptions, parameters, request examples, schemas,
and response tables from it. The Markdown files are curated guides for
authentication, conventions, error handling, and non-Postman testing; do not
add endpoint behavior here without updating the contract.

## Current scope

The API currently contains the identity slice:

| Category | Endpoints | Status |
| --- | --- | --- |
| Health | `GET /healthz`, `GET /readyz` | Implemented |
| Documentation | `GET /v1/openapi.yaml` | Implemented |
| Identity | `GET /v1/auth/csrf`, `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/me` | Implemented |
| Organizations | `GET /v1/organizations` | Implemented |
| Catalog, inventory, orders, leases, messaging, billing, providers, realtime | — | Not implemented yet |

The API does not return fake inventory, prices, messages, or provider status.
Future domains will be added here and in the OpenAPI contract as they are
implemented.

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

## Related source

- Contract tests: `backend/internal/server/integration_test.go`,
  `backend/internal/server/error_paths_test.go`
- OpenAPI validation: contract responses are validated by
  `assertContract` in the integration tests.
- Scalar frontend route: `frontend/app/routes/api-docs.tsx`
