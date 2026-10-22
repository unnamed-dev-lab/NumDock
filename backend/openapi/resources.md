# Account resources

Current contract version: 0.11. The aggregate workspace/view API has been removed.
All private resource paths below are relative to /v1/organizations/{organization_id};
the identifier is
an internal ownership boundary and every request checks the session's membership.

| Method | Path | Response |
| --- | --- | --- |
| GET | /summary | Mode, role, current wallet and counts; no resource records |
| GET | /numbers | NumberList; includes catalog use-case tags |
| GET | /messages | MessageList; no message bodies |
| GET | /messages/{resource_id} | Authorized message body, audited on access |
| GET | /orders | OrderList |
| GET | /billing/wallet | WalletState |
| GET | /billing/ledger | LedgerList |
| GET | /billing/payments | PaymentList |
| GET | /billing/payments/{reference} | One payment order for this account |
| GET | /events/stream | Resumable resource metadata events |

Lists return {items, mode, total, limit, offset}. Only the requested resource is
included, with limit/offset/status/q query parameters. Status values depend on
the resource. Unknown or repeated parameters are rejected. Summary and wallet
do not accept list parameters. Query parameters do not select resource types.

Customer write paths keep payment creation/confirmation/cancellation, number
purchase/release/refund and private message deletion. Browser writes require
Origin, CSRF and Idempotency-Key. API keys, outbound customer Webhooks and direct
mock-credit are no longer exposed. Their old paths, including /workspace, return
404. Cookie authentication is required; Bearer credentials are rejected.

The public catalog remains GET /v1/catalog/numbers. Monitoring probes and the
OpenAPI document remain backend infrastructure. Public technical status pages,
the interactive API documentation and the developer console have been removed
from the product. Historical developer tables are retained without exposing them
or scheduling new deliveries; obsolete delivery jobs complete without networking.
