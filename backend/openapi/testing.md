# Local API testing without Postman

The project ships an interactive Scalar API reference at `/docs/api`. It can
send real requests, including cookie-authenticated requests, through the
frontend's same-origin proxy.

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

Open **http://localhost:3000/docs/api**.

The page:

1. Loads the contract from `/v1/openapi.yaml`.
2. Calls `GET /v1/auth/csrf` and stores the returned token in memory.
3. Sends cookies with `credentials: "include"`.
4. Adds `X-CSRF-Token` to non-GET requests.
5. Lets the browser add `Origin` automatically for same-origin POST requests.

The token is kept in memory, not localStorage. The session itself remains in
the HttpOnly cookie. If the CSRF bootstrap fails, use the refresh action in the
docs header and confirm the Go API and frontend proxy are running.

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
is required only for register, login, and logout.

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

## What the docs page does not do

- It does not create fake accounts, inventory, messages, or payments.
- It does not bypass CSRF or session validation.
- It does not expose session tokens or CSRF tokens in localStorage.
- It does not replace the integration tests. Contract and behavior tests remain
  in `backend/internal/server/`.
