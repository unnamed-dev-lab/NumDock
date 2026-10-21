-- name: EnsureWallet :exec
INSERT INTO wallets(organization_id) VALUES($1) ON CONFLICT DO NOTHING;
-- name: GetWallet :one
SELECT * FROM wallets WHERE organization_id=$1;
-- name: LockWallet :one
SELECT * FROM wallets WHERE organization_id=$1 FOR UPDATE;
-- name: UpdateWallet :one
UPDATE wallets SET available_minor=available_minor+sqlc.arg(available_delta)::bigint,reserved_minor=reserved_minor+sqlc.arg(reserved_delta)::bigint WHERE organization_id=sqlc.arg(organization_id) RETURNING *;
-- name: RecordLedger :exec
INSERT INTO ledger_entries(organization_id,reference_id,kind,available_delta,reserved_delta,available_after,reserved_after) VALUES($1,$2,$3,$4,$5,$6,$7);
-- name: LockCatalogItem :one
SELECT * FROM catalog_items WHERE id=$1 FOR UPDATE;
-- name: SetCatalogStatus :exec
UPDATE catalog_items SET status=$2 WHERE id=$1;
-- name: CreateLease :one
INSERT INTO leases(organization_id,order_id,catalog_item_id,status,provider_reference,expires_at) VALUES($1,$2,$3,'active',$4,$5) RETURNING *;
-- name: LockLease :one
SELECT * FROM leases WHERE id=$1 AND organization_id=$2 FOR UPDATE;
-- name: FinishLease :one
UPDATE leases SET status=$3,ended_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *;
-- name: ListNumbers :many
SELECT l.id,l.status,l.started_at,l.expires_at,l.ended_at,l.catalog_item_id,l.order_id,c.e164,c.country_code,c.number_type,c.capabilities,c.monthly_fee_minor
FROM leases l JOIN catalog_items c ON c.id=l.catalog_item_id
WHERE l.organization_id=sqlc.arg(organization_id)
AND (sqlc.arg(status)::text='' OR l.status=sqlc.arg(status))
AND (sqlc.arg(search)::text='' OR strpos(c.e164,sqlc.arg(search))>0)
ORDER BY l.started_at DESC,l.id DESC LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);
-- name: CountNumbers :one
SELECT count(*) FROM leases l JOIN catalog_items c ON c.id=l.catalog_item_id WHERE l.organization_id=$1 AND ($2::text='' OR l.status=$2) AND ($3::text='' OR strpos(c.e164,$3)>0);
-- name: ListOrders :many
SELECT o.*,c.e164 FROM orders o JOIN catalog_items c ON c.id=o.catalog_item_id
WHERE o.organization_id=$1 AND ($2::text='' OR o.status=$2) ORDER BY o.created_at DESC,o.id DESC LIMIT $3 OFFSET $4;
-- name: CountOrders :one
SELECT count(*) FROM orders WHERE organization_id=$1 AND ($2::text='' OR status=$2);
-- name: ListLedger :many
SELECT * FROM ledger_entries WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3;
-- name: CountLedger :one
SELECT count(*) FROM ledger_entries WHERE organization_id=$1;
-- name: WorkspaceCounts :one
SELECT (SELECT count(*) FROM leases l WHERE l.organization_id=$1 AND l.status='active' AND l.expires_at>now())::bigint AS numbers,
(SELECT count(*) FROM messages m WHERE m.organization_id=$1 AND m.expires_at>now() AND m.read_at IS NULL)::bigint AS unread_messages,
(SELECT count(*) FROM orders o WHERE o.organization_id=$1 AND o.status='completed')::bigint AS completed_orders;

-- name: LockOrder :one
SELECT * FROM orders WHERE id=$1 AND organization_id=$2 FOR UPDATE;
-- name: RefundOrder :exec
UPDATE orders SET status='refunded' WHERE id=$1 AND organization_id=$2;

-- name: CreateOrderWithID :one
INSERT INTO orders(id,organization_id,user_id,catalog_item_id,status,purpose,amount_minor,failure_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;
-- name: OrderHasActiveLease :one
SELECT EXISTS(SELECT 1 FROM leases WHERE order_id=$1 AND status='active');

-- name: ReactivateCatalog :exec
UPDATE catalog_items c SET status='available' WHERE c.id=$1 AND c.status='quarantined' AND NOT EXISTS(SELECT 1 FROM leases WHERE catalog_item_id=$1 AND status='active');
