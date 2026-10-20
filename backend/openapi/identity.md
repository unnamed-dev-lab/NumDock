# Identity and organizations API

This document describes the currently implemented identity and organization
endpoints. The machine-readable contract is
[`openapi.yaml`](openapi.yaml); the shared error model is documented in
[`errors.md`](errors.md). The Scalar page at `/docs/api` renders operation
summaries, descriptions, parameters, examples, and response tables directly
from the OpenAPI file. Keep endpoint behavior and examples in the contract
first; this Markdown file is a human-readable guide, not a second contract.

## Endpoint summary

| Method | Path | Authentication | CSRF | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/auth/csrf` | None | No | Obtain a CSRF token and cookie |
| `POST` | `/v1/auth/register` | None | Yes | Create user, organization, owner membership, and session |
| `POST` | `/v1/auth/login` | None | Yes | Verify credentials and rotate the session |
| `POST` | `/v1/auth/logout` | Session | Yes | Revoke the current session |
| `GET` | `/v1/me` | Session | No | Return the current user and memberships |
| `GET` | `/v1/organizations` | Session | No | Return the current user's organizations |

All browser mutations require:

```http
Origin: http://localhost:3000
X-CSRF-Token: <token returned by GET /v1/auth/csrf>
Content-Type: application/json
```

The backend compares `Origin` exactly with `APP_ORIGIN`. Use one hostname
consistently; do not mix `localhost` and `127.0.0.1`.

## GET /v1/auth/csrf

Returns a CSRF token and sets the matching HttpOnly CSRF cookie.

### Response `200`

```json
{
  "token": "J8x2mQ7v1sK4pR9tY6nB3cD5eF0gH2jL4mN6oP8qR1s"
}
```

The token is 43 URL-safe Base64 characters. Reuse the existing cookie token
while it is valid; the endpoint returns it again instead of rotating it.

### Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `500` | `internal_error` | Token generation failed |
| `504` | `request_timeout` | Request exceeded the server timeout |

## POST /v1/auth/register

Creates a user, an organization, an owner membership, and a session in one
database transaction. The previous session cookie, when present, is revoked.
The new session cookie is only set after the transaction commits.

### Request

```json
{
  "email": "alex@example.com",
  "password": "a sufficiently long passphrase",
  "name": "Alex",
  "organization_name": "Alpha"
}
```

Validation:

- `email` is trimmed, lowercased, and must be a valid address of at most 254 bytes.
- `password` must contain 12–128 Unicode code points.
- `name` and `organization_name` must contain 1–100 Unicode characters.
- Unknown JSON fields, multiple JSON objects, and bodies larger than 8192
  bytes are rejected.

### Response `201`

```json
{
  "user": {
    "id": "4d9e54b0-7e4b-4f97-9a2f-5d9e0c5b4a21",
    "email": "alex@example.com",
    "name": "Alex",
    "created_at": "2026-10-20T12:00:00Z"
  },
  "organizations": [
    {
      "id": "6c72da79-7c19-49a9-95c9-18d979051b3f",
      "name": "Alpha",
      "role": "owner",
      "created_at": "2026-10-20T12:00:00Z"
    }
  ]
}
```

The response also sets the session cookie.

### Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_request` | Malformed JSON or unsupported JSON shape |
| `400` | `validation_failed` | Email, password, name, or organization name invalid |
| `403` | `csrf_failed` | Origin or CSRF token missing/invalid |
| `409` | `account_unavailable` | Email cannot be used; message is intentionally generic |
| `413` | `payload_too_large` | Request body exceeds 8192 bytes |
| `415` | `unsupported_media_type` | Content-Type is not `application/json` |
| `429` | `rate_limited` | IP or email rate limit exceeded; see `Retry-After` |
| `500` | `internal_error` | Unexpected server/database failure |
| `504` | `request_timeout` | Request exceeded the server timeout |

## POST /v1/auth/login

Verifies the password, revokes the presented session cookie when present,
creates a new session, and returns the current identity. Missing accounts
still perform a dummy password hash to reduce timing differences.

### Request

```json
{
  "email": "alex@example.com",
  "password": "a sufficiently long passphrase"
}
```

### Response `200`

Same `Identity` shape as registration. The response sets a new session
cookie.

### Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_request` | Malformed JSON or unsupported JSON shape |
| `400` | `validation_failed` | Email or password format invalid |
| `401` | `invalid_credentials` | Email or password is incorrect |
| `403` | `csrf_failed` | Origin or CSRF token missing/invalid |
| `413` | `payload_too_large` | Request body exceeds 8192 bytes |
| `415` | `unsupported_media_type` | Content-Type is not `application/json` |
| `429` | `rate_limited` | IP or email rate limit exceeded; see `Retry-After` |
| `500` | `internal_error` | Unexpected server/database failure |
| `504` | `request_timeout` | Request exceeded the server timeout |

## POST /v1/auth/logout

Revokes the current session in PostgreSQL and clears the session cookie.

### Request

No body. Requires the session cookie, `Origin`, and `X-CSRF-Token`.

### Response `204`

No body. The response clears the session cookie.

### Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `401` | `unauthenticated` | Session missing, expired, or already revoked |
| `403` | `csrf_failed` | Origin or CSRF token missing/invalid |
| `500` | `internal_error` | Session could not be deleted |
| `504` | `request_timeout` | Request exceeded the server timeout |

## GET /v1/me

Returns the authenticated user and their own organization memberships. The
session user is loaded from PostgreSQL and the organization list is scoped by
the authenticated user ID; no client-supplied organization or role is
trusted.

### Response `200`

Same `Identity` shape as registration.

### Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `401` | `unauthenticated` | Session missing, expired, or revoked |
| `500` | `internal_error` | Identity could not be loaded |
| `504` | `request_timeout` | Request exceeded the server timeout |

## GET /v1/organizations

Returns organizations joined by the authenticated user, ordered by creation
time and ID ascending.

### Query parameters

| Name | Type | Default | Rules |
| --- | --- | --- | --- |
| `limit` | integer | `20` | `1..100` |
| `offset` | integer | `0` | `>= 0` |

### Response `200`

```json
{
  "items": [
    {
      "id": "6c72da79-7c19-49a9-95c9-18d979051b3f",
      "name": "Alpha",
      "role": "owner",
      "created_at": "2026-10-20T12:00:00Z"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

### Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `validation_failed` | Invalid `limit` or `offset` |
| `401` | `unauthenticated` | Session missing, expired, or revoked |
| `500` | `internal_error` | Organizations could not be loaded |
| `504` | `request_timeout` | Request exceeded the server timeout |

## Health endpoints

| Method | Path | Purpose | Success | Failure |
| --- | --- | --- | --- | --- |
| `GET` | `/healthz` | Process liveness | `200 {"status":"ok"}` | `500`, `504` |
| `GET` | `/readyz` | PostgreSQL readiness | `200 {"status":"ready"}` | `503 not_ready`, `500`, `504` |

`/healthz` does not check the database. `/readyz` pings PostgreSQL with a
one-second timeout and should be used by load balancers and orchestrators.

## Document endpoint

`GET /v1/openapi.yaml` returns the machine-readable OpenAPI 3.0 contract as
`application/yaml`. It is also what the Scalar page at `/docs/api` loads.
