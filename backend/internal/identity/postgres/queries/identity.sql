-- name: CreateUser :one
INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *;

-- name: UserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: CreateOrganization :one
INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *;

-- name: CreateMembership :exec
INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'owner');

-- name: CreateSession :exec
INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3);

-- name: SessionUser :one
SELECT users.* FROM users JOIN sessions ON sessions.user_id = users.id
WHERE sessions.token_hash = $1 AND sessions.expires_at > now();

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token_hash = $1;

-- name: UserOrganizations :many
SELECT organizations.id, organizations.name, organizations.slug, memberships.role, organizations.created_at
FROM organizations JOIN memberships ON memberships.organization_id = organizations.id
WHERE memberships.user_id = $1 ORDER BY organizations.created_at, organizations.id;

-- name: ConsumeAuthLimit :one
-- Persistent fixed-window counters, scoped by a hashed IP or email key.
INSERT INTO auth_rate_limits (key, attempts, expires_at)
VALUES ($1, 1, now() + interval '1 minute')
ON CONFLICT (key) DO UPDATE SET
    attempts = CASE WHEN auth_rate_limits.expires_at <= now() THEN 1 ELSE auth_rate_limits.attempts + 1 END,
    expires_at = CASE WHEN auth_rate_limits.expires_at <= now() THEN now() + interval '1 minute' ELSE auth_rate_limits.expires_at END
RETURNING attempts;

-- name: PruneAuthLimits :exec
DELETE FROM auth_rate_limits WHERE expires_at <= now();

-- name: PruneSessions :exec
DELETE FROM sessions WHERE expires_at <= now();

-- name: ListUserOrganizations :many
SELECT organizations.id, organizations.name, organizations.slug, memberships.role, organizations.created_at
FROM organizations JOIN memberships ON memberships.organization_id = organizations.id
WHERE memberships.user_id = $1 ORDER BY organizations.created_at, organizations.id
LIMIT $2 OFFSET $3;
