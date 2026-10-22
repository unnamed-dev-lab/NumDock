# Mock API UI integration tests

Run the deterministic browser flows without PostgreSQL or the Go API:

```powershell
pnpm test:e2e:mock
```

`playwright.mock.config.ts` starts two servers:

- the in-memory mock API in `tests/mock-api/server.mjs` on port 8092
- the Vite frontend on port 3102 with `API_INTERNAL_URL` pointing at the mock

The suite covers the customer-facing payment and leasing path:

- add balance and confirm a pending payment
- cancel a pending payment without crediting the balance
- retry a lost payment confirmation with the same idempotency key
- select a catalog number, choose a rental term, confirm the lease
- verify the leased number and its use-case tags in "Your numbers"
- verify the wallet after the lease
- keep the lease confirmation open when the wallet has insufficient balance
- keep the catalog and wallet unchanged when inventory becomes unavailable
- invalidate the summary through SSE without reloading the page
- refresh a second billing page after a payment mutation through SSE
- complete payment and lease at 390px in dark mode without horizontal overflow
- show the catalog loading skeleton before the first result
- expose additional use cases through the homepage More menu

Each test resets the in-memory state through `POST /__reset`. The mock server
implements the same response shapes used by the generated OpenAPI client,
including CSRF, summary, list, order, payment and SSE endpoints.
