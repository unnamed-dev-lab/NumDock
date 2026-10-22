# Catalog API

`GET /v1/catalog/numbers` is public: visitors can browse available numbers and prices without a session or CSRF token. Private organization data and all purchase operations remain authenticated. Parameters, schemas, and response codes are defined in [OpenAPI](openapi.yaml).

```text
/v1/catalog/numbers?country=CA&number_type=mobile&capability=sms&sort=monthly_fee_minor&order=asc&limit=10&offset=0
```

| Parameter | Values / meaning |
| --- | --- |
| `country` | Two uppercase letters, e.g. US or CA; no match gives an empty list |
| `number_type` | mobile, local, toll_free |
| `capability` | sms, voice, mms |
| `use_case` | openai, google, telegram, whatsapp, discord, tiktok, amazon, paypal, uber, x, facebook, instagram, microsoft, apple, other |
| `q` | Up to 100 Unicode characters; literal case-insensitive substring of number, country name, region, provider or use-case tags |
| `sort` | e164 (default), monthly_fee_minor, inbound_sms_fee_micros |
| `order` | asc (default), desc |
| `limit` | 1–100, default 20 |
| `offset` | 0–2147483647, default 0 |

Filters combine with AND. Unknown/repeated parameters and invalid enum/range values produce `400 validation_failed`. The ID is a stable ordering tie-breaker. `total` counts all matching records, even for an empty page past the end. An empty list is `[]`, never null.

Response: `{items, total, limit, offset, mode}`. Each item includes `source=mock`, `provider=NumDock Mock`, `currency=USD`, integer `monthly_fee_minor` (cents), integer `inbound_sms_fee_micros` (millionths of USD), and `use_cases` tags. Use-case tags describe intended scenarios only; they do not guarantee that a third-party service will accept the number. Each item also includes rental_options: authoritative quotes for 3, 7 and 30 days, with days and amount_minor. Development pricing is ceil(monthly_fee_minor × days / 30) in integer USD cents; there is no automatic renewal. Mock SMS simulation is free.

Only `APP_ENV=development` serves seeded data (`mode=mock`). Other modes return `mode=disabled`, `items=[]`, `total=0`, even against a seeded database. All requests validate parameters. Only available inventory is listed. Development leasing, messages, wallets and refunds are documented in [Mock workspace](../../docs/mock-workspace.md). No live provider or payment is connected.
