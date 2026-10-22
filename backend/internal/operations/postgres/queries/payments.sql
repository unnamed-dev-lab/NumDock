-- name: CreatePayment :one
INSERT INTO payment_orders(organization_id,user_id,amount_minor) VALUES($1,$2,$3) RETURNING *;
-- name: LockPayment :one
SELECT * FROM payment_orders WHERE id=$1 AND organization_id=$2 FOR UPDATE;
-- name: FinishPayment :one
UPDATE payment_orders SET status=$3,completed_at=now() WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING *;
-- name: ListPayments :many
SELECT id,reference,amount_minor,currency,provider,
 CASE WHEN status='pending' AND expires_at<=now() THEN 'expired' ELSE status END::text AS status,
 created_at,expires_at
FROM payment_orders WHERE organization_id=sqlc.arg(organization_id)
 AND (sqlc.arg(status)::text='' OR CASE WHEN status='pending' AND expires_at<=now() THEN 'expired' ELSE status END=sqlc.arg(status))
 AND (sqlc.arg(search)::text='' OR reference=sqlc.arg(search))
ORDER BY created_at DESC,id DESC LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);
-- name: CountPayments :one
SELECT count(*) FROM payment_orders WHERE organization_id=sqlc.arg(organization_id)
 AND (sqlc.arg(status)::text='' OR CASE WHEN status='pending' AND expires_at<=now() THEN 'expired' ELSE status END=sqlc.arg(status))
 AND (sqlc.arg(search)::text='' OR reference=sqlc.arg(search));
-- name: ExpirePayment :one
UPDATE payment_orders SET status='expired',completed_at=now()
WHERE id=$1 AND status='pending' AND expires_at<=now() RETURNING organization_id;
