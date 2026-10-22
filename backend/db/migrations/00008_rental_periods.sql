-- +goose Up
ALTER TABLE orders ADD COLUMN rental_days integer NOT NULL DEFAULT 30 CHECK (rental_days IN (3,7,30));

-- +goose Down
ALTER TABLE orders DROP COLUMN rental_days;
