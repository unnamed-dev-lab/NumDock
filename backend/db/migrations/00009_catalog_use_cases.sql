-- +goose Up
ALTER TABLE catalog_items
    ADD COLUMN use_cases text[] NOT NULL DEFAULT ARRAY['other']::text[];

ALTER TABLE catalog_items
    ADD CONSTRAINT catalog_items_use_cases_check CHECK (
        cardinality(use_cases) > 0
        AND use_cases <@ ARRAY[
            'openai',
            'google',
            'telegram',
            'whatsapp',
            'discord',
            'tiktok',
            'amazon',
            'paypal',
            'uber',
            'x',
            'facebook',
            'instagram',
            'microsoft',
            'apple',
            'other'
        ]::text[]
    );

CREATE INDEX catalog_items_use_cases_idx ON catalog_items USING GIN (use_cases);

-- +goose Down
DROP INDEX catalog_items_use_cases_idx;
ALTER TABLE catalog_items DROP COLUMN use_cases;
