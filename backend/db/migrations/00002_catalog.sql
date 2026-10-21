-- +goose Up
-- Only explicit development fixtures are supported in this slice. Live inventory
-- requires an authorized provider adapter and its own lifecycle implementation.
CREATE TABLE catalog_items (
    id text PRIMARY KEY,
    e164 text NOT NULL UNIQUE CHECK (e164 ~ '^\+[1-9][0-9]{6,14}$'),
    country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    country_name text NOT NULL,
    region text NOT NULL,
    number_type text NOT NULL CHECK (number_type IN ('mobile', 'local', 'toll_free')),
    capabilities text[] NOT NULL CHECK (cardinality(capabilities) > 0 AND capabilities <@ ARRAY['sms', 'voice', 'mms']::text[]),
    provider text NOT NULL CHECK (provider = 'NumDock Mock'),
    source text NOT NULL CHECK (source = 'mock'),
    currency text NOT NULL CHECK (currency = 'USD'),
    monthly_fee_minor integer NOT NULL CHECK (monthly_fee_minor >= 0),
    inbound_sms_fee_micros integer NOT NULL CHECK (inbound_sms_fee_micros >= 0),
    status text NOT NULL CHECK (status = 'available'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalog_items_country_type_idx ON catalog_items(country_code, number_type);

-- +goose Down
DROP TABLE catalog_items;
