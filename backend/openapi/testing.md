# Local API testing without Postman

Use the frontend's same-origin proxy with a cookie-aware HTTP client. The raw
contract is available at /v1/openapi.yaml; the product no longer includes an
interactive API reference. Private resource examples are in
[examples/resources.http](examples/resources.http).

## Start the stack

```powershell
./scripts/backend.ps1 migrate
./scripts/backend.ps1 run
```

In another terminal:

```powershell
cd frontend
pnpm dev
```

Keep `APP_ORIGIN` aligned with the browser URL. For this example it is
`http://localhost:3000`; `http://127.0.0.1:3000` is a different origin.

## PowerShell flow

```powershell
$base = "http://localhost:3000"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$csrf = (Invoke-RestMethod -Uri "$base/v1/auth/csrf" -WebSession $session).token
$headers = @{
    Origin         = $base
    "X-CSRF-Token" = $csrf
}

$registration = @{
    email             = "alex@example.com"
    password          = "a sufficiently long passphrase"
    name              = "Alex"
    organization_name = "Alpha"
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri "$base/v1/auth/register" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $registration `
    -WebSession $session

Invoke-RestMethod -Uri "$base/v1/me" -WebSession $session

Invoke-RestMethod `
    -Method Post `
    -Uri "$base/v1/auth/logout" `
    -Headers $headers `
    -WebSession $session
```

`$session` stores the HttpOnly cookies for subsequent requests. The CSRF token
is required for all browser writes. Business writes also require Idempotency-Key.

## curl flow

```bash
base=http://localhost:3000

curl -sS -c cookies.txt "$base/v1/auth/csrf" -o csrf.json
token=$(python3 -c 'import json; print(json.load(open("csrf.json"))["token"])')

curl -sS -b cookies.txt -c cookies.txt \
  -H "Origin: $base" \
  -H "X-CSRF-Token: $token" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"a sufficiently long passphrase","name":"Alex","organization_name":"Alpha"}' \
  "$base/v1/auth/register"

curl -sS -b cookies.txt "$base/v1/me"
```

Use `jq -r .token` instead of the Python one-liner if it is installed.

## Direct API testing

The direct API is available at `http://127.0.0.1:8080`, but it must receive an
`Origin` matching `APP_ORIGIN`. If you set `APP_ORIGIN=http://127.0.0.1:3000`,
open the frontend at that origin rather than `localhost`. For the normal local
setup, use the frontend proxy at `localhost:3000`.

## Verification

Backend integration and contract tests live in backend/internal/server/. Customer
flows are exercised by frontend/tests/. API keys and outbound customer Webhooks
are no longer supported; use an authenticated cookie session for private APIs.
