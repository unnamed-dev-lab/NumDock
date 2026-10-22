-- +goose Up
CREATE TABLE payment_orders (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 reference text NOT NULL UNIQUE DEFAULT ('PAY-' || upper(replace(gen_random_uuid()::text, '-', ''))),
 organization_id text NOT NULL REFERENCES organizations(id),
 user_id text NOT NULL REFERENCES users(id),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 100 AND 1000000),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 provider text NOT NULL DEFAULT 'mock' CHECK(provider='mock'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','succeeded','failed','canceled','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
 completed_at timestamptz,
 CHECK(expires_at > created_at),
 CHECK((status='pending') = (completed_at IS NULL))
);
CREATE INDEX payment_orders_account_created_idx ON payment_orders(organization_id,created_at DESC,id);
ALTER TABLE ledger_entries DROP CONSTRAINT ledger_entries_kind_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK(kind IN ('mock_credit','payment_credit','reserve','settle','release','refund'));

-- +goose Down
-- Keep the old ledger schema compatible without rewriting immutable entries.
ALTER TABLE ledger_entries DROP CONSTRAINT ledger_entries_kind_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK(kind IN ('mock_credit','payment_credit','reserve','settle','release','refund'));
DROP TABLE payment_orders;
