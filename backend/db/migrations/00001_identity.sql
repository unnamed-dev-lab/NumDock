-- +goose Up
CREATE TABLE users (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email text NOT NULL UNIQUE CHECK (email = lower(email)),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE auth_rate_limits (
    key text PRIMARY KEY,
    attempts integer NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX auth_rate_limits_expires_at_idx ON auth_rate_limits(expires_at);

-- +goose Down
DROP TABLE auth_rate_limits;
DROP TABLE sessions;
DROP TABLE memberships;
DROP TABLE organizations;
DROP TABLE users;
