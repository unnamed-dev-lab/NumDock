-- +goose Up
ALTER TABLE organizations ADD COLUMN slug text;
UPDATE organizations SET slug = CASE
    WHEN id = 'd0000000-0000-4000-8000-000000000001' THEN 'numdock-development'
    WHEN id = 'd0000000-0000-4000-8000-000000000002' THEN 'numdock-isolated'
    ELSE coalesce(nullif(trim(both '-' from regexp_replace(lower(left(name, 60)), '[^a-z0-9]+', '-', 'g')), ''), 'workspace')
         || '-' || left(replace(gen_random_uuid()::text, '-', ''), 16)
END;
ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;
ALTER TABLE organizations ALTER COLUMN slug SET DEFAULT ('workspace-' || replace(gen_random_uuid()::text, '-', ''));
ALTER TABLE organizations ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);
ALTER TABLE organizations ADD CONSTRAINT organizations_slug_length CHECK (length(slug) BETWEEN 1 AND 100);

-- +goose Down
ALTER TABLE organizations DROP COLUMN slug;
