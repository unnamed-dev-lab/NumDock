-- +goose Up
CREATE TABLE operation_limits (
 key text PRIMARY KEY, bucket timestamptz NOT NULL DEFAULT date_trunc('minute',now()), attempts integer NOT NULL DEFAULT 1
);

-- +goose Down
DROP TABLE operation_limits;
