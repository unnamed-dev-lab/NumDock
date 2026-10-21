# Catalog API

`GET /v1/catalog/numbers` requires the same valid session cookie as `/v1/me`. This read-only request does not require CSRF. Parameters, schemas, and response codes are defined in [OpenAPI](openapi.yaml) and displayed in Scalar at `/docs/api`.

```text
/v1/catalog/numbers?country=CA&number_type=mobile&capability=sms&sort=monthly_fee_minor&order=asc&limit=10&offset=0
```

| Parameter | Values / meaning |
| --- | --- |
| `country` | Two uppercase letters, e.g. US or CA; no match gives an empty list |
| `number_type` | mobile, local, toll_free |
| `capability` | sms, voice, mms |
| `q` | Up to 100 Unicode characters; literal case-insensitive substring of number, country name, region or provider |
| `sort` | e164 (default), monthly_fee_minor, inbound_sms_fee_micros |
| `order` | asc (default), desc |
| `limit` | 1–100, default 20 |
| `offset` | 0–2147483647, default 0 |

Filters combine with AND. Unknown/repeated parameters and invalid enum/range values produce `400 validation_failed`. The ID is a stable ordering tie-breaker. `total` counts all matching records, even for an empty page past the end. An empty list is `[]`, never null.

Response: `{items, total, limit, offset, mode}`. Each item includes `source=mock`, `provider=NumDock Mock`, `currency=USD`, integer `monthly_fee_minor` (cents) and integer `inbound_sms_fee_micros` (millionths of USD). The 30-day Mock lease deducts monthly_fee_minor from the development wallet; Mock SMS simulation is free.

Only `APP_ENV=development` serves seeded data (`mode=mock`). Other modes return `mode=disabled`, `items=[]`, `total=0`, even against a seeded database. All requests still require authentication and validate parameters. Only available inventory is listed. Development leasing, messages, wallets and refunds are documented in [Mock workspace](../../docs/mock-workspace.md). No live provider or payment is connected.
