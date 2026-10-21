-- name: SeedLock :exec
SELECT pg_advisory_xact_lock(724690120261021);

-- name: SeedUser :exec
INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO NOTHING;

-- name: VerifySeedUser :one
SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND email = $2);

-- name: SeedOrganization :exec
INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING;

-- name: SeedMembership :exec
INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, $3)
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- name: SeedCatalogItem :exec
INSERT INTO catalog_items (id, e164, country_code, country_name, region, number_type, capabilities, provider, source, currency, monthly_fee_minor, inbound_sms_fee_micros, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'NumDock Mock', 'mock', 'USD', $8, $9, 'available')
ON CONFLICT (id) DO NOTHING;
