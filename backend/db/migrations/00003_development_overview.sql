-- +goose Up
-- Demo aggregates are isolated from real orders, leases, messages and ledgers.
CREATE TABLE development_overview_daily (
    organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    day date NOT NULL,
    active_numbers integer NOT NULL CHECK (active_numbers >= 0),
    messages_received integer NOT NULL CHECK (messages_received >= 0),
    messages_failed integer NOT NULL CHECK (messages_failed BETWEEN 0 AND messages_received),
    orders_completed integer NOT NULL CHECK (orders_completed >= 0),
    spend_minor integer NOT NULL CHECK (spend_minor >= 0),
    source text NOT NULL DEFAULT 'mock' CHECK (source = 'mock'),
    seeded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, day)
);

-- +goose Down
DROP TABLE development_overview_daily;
