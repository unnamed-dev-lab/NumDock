-- +goose Up
ALTER TABLE catalog_items DROP CONSTRAINT catalog_items_status_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_status_check CHECK(status IN ('available','allocated','quarantined'));

CREATE TABLE wallets (
 organization_id text PRIMARY KEY REFERENCES organizations(id),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 available_minor bigint NOT NULL DEFAULT 0 CHECK(available_minor>=0),
 reserved_minor bigint NOT NULL DEFAULT 0 CHECK(reserved_minor>=0)
);
CREATE TABLE operation_requests (
 organization_id text NOT NULL REFERENCES organizations(id), operation text NOT NULL,
 key text NOT NULL CHECK(length(key) BETWEEN 8 AND 128), request_hash bytea NOT NULL,
 response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,operation,key)
);
CREATE TABLE orders (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 organization_id text NOT NULL REFERENCES organizations(id), user_id text NOT NULL REFERENCES users(id),
 catalog_item_id text NOT NULL REFERENCES catalog_items(id),
 status text NOT NULL CHECK(status IN ('processing','completed','failed','refunded')),
 purpose text NOT NULL CHECK(purpose IN ('customer_support','product_notifications','service_testing')),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0), currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 failure_code text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'mock' CHECK(source='mock'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_org_created_idx ON orders(organization_id,created_at DESC,id);
CREATE TABLE leases (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 organization_id text NOT NULL REFERENCES organizations(id), order_id text NOT NULL UNIQUE REFERENCES orders(id),
 catalog_item_id text NOT NULL REFERENCES catalog_items(id),
 status text NOT NULL CHECK(status IN ('active','released','expired')),
 provider_reference text NOT NULL UNIQUE, started_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 ended_at timestamptz, source text NOT NULL DEFAULT 'mock' CHECK(source='mock'),
 CHECK(expires_at>started_at)
);
CREATE UNIQUE INDEX leases_exclusive_idx ON leases(catalog_item_id) WHERE status='active';
CREATE INDEX leases_org_created_idx ON leases(organization_id,started_at DESC,id);
CREATE TABLE ledger_entries (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 organization_id text NOT NULL REFERENCES organizations(id), reference_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('mock_credit','reserve','settle','release','refund')),
 available_delta bigint NOT NULL, reserved_delta bigint NOT NULL,
 available_after bigint NOT NULL CHECK(available_after>=0), reserved_after bigint NOT NULL CHECK(reserved_after>=0),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'), source text NOT NULL DEFAULT 'mock' CHECK(source='mock'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,reference_id,kind)
);
-- +goose StatementBegin
CREATE FUNCTION reject_ledger_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ledger entries are immutable'; END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION reject_ledger_changes();
CREATE INDEX ledger_org_created_idx ON ledger_entries(organization_id,created_at DESC,id);
CREATE TABLE provider_events (
 id text PRIMARY KEY, lease_id text NOT NULL, payload_hash bytea NOT NULL, payload_ciphertext bytea,
 state text NOT NULL CHECK(state IN ('accepted','quarantined')), received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE messages (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, organization_id text NOT NULL REFERENCES organizations(id),
 lease_id text NOT NULL REFERENCES leases(id), provider_event_id text NOT NULL UNIQUE REFERENCES provider_events(id),
 payload_ciphertext bytea NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 read_at timestamptz, source text NOT NULL DEFAULT 'mock' CHECK(source='mock')
);
CREATE INDEX messages_org_received_idx ON messages(organization_id,received_at DESC,id);
CREATE TABLE api_keys (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, organization_id text NOT NULL REFERENCES organizations(id),
 user_id text NOT NULL REFERENCES users(id), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 prefix text NOT NULL, token_hash bytea NOT NULL UNIQUE, scopes text[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz, last_used_at timestamptz,
 CHECK(cardinality(scopes)>0 AND scopes <@ ARRAY['numbers:read','numbers:write','messages:read','billing:read']::text[])
);
CREATE INDEX api_keys_org_idx ON api_keys(organization_id,created_at DESC,id);
CREATE TABLE webhook_endpoints (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, organization_id text NOT NULL REFERENCES organizations(id),
 url text NOT NULL, secret_ciphertext bytea NOT NULL, enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspace_events (
 id bigserial PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id),
 type text NOT NULL, resource_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_events_org_idx ON workspace_events(organization_id,id);
CREATE TABLE webhook_deliveries (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, endpoint_id text NOT NULL REFERENCES webhook_endpoints(id),
 organization_id text NOT NULL REFERENCES organizations(id), event_id bigint NOT NULL REFERENCES workspace_events(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','succeeded','failed','disabled')),
 attempts integer NOT NULL DEFAULT 0, response_status integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(endpoint_id,event_id)
);
CREATE TABLE operation_audit (
 id bigserial PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id), user_id text REFERENCES users(id),
 action text NOT NULL, resource_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- +goose Down
DROP TABLE operation_audit;
DROP TABLE webhook_deliveries;
DROP TABLE workspace_events;
DROP TABLE webhook_endpoints;
DROP TABLE api_keys;
DROP TABLE messages;
DROP TABLE provider_events;
DROP TABLE ledger_entries;
DROP FUNCTION reject_ledger_changes;
DROP TABLE leases;
DROP TABLE orders;
DROP TABLE operation_requests;
DROP TABLE wallets;
ALTER TABLE catalog_items DROP CONSTRAINT catalog_items_status_check;
UPDATE catalog_items SET status='available';
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_status_check CHECK(status='available');
