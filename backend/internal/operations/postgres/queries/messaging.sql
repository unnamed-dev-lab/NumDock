-- name: ExistingProviderEvent :one
SELECT payload_hash FROM provider_events WHERE id=$1;
-- name: SaveProviderEvent :exec
INSERT INTO provider_events(id,lease_id,payload_hash,payload_ciphertext,state) VALUES($1,$2,$3,$4,$5);
-- name: CreateMessage :one
INSERT INTO messages(id,organization_id,lease_id,provider_event_id,payload_ciphertext,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *;
-- name: ListMessages :many
SELECT m.id,m.lease_id,m.received_at,m.expires_at,m.read_at,c.e164 FROM messages m JOIN leases l ON l.id=m.lease_id JOIN catalog_items c ON c.id=l.catalog_item_id
WHERE m.organization_id=$1 AND m.expires_at>now() AND ($2::text='' OR ($2='unread' AND m.read_at IS NULL) OR ($2='read' AND m.read_at IS NOT NULL)) ORDER BY m.received_at DESC,m.id DESC LIMIT $3 OFFSET $4;
-- name: CountMessages :one
SELECT count(*) FROM messages WHERE organization_id=$1 AND expires_at>now() AND ($2::text='' OR ($2='unread' AND read_at IS NULL) OR ($2='read' AND read_at IS NOT NULL));
-- name: ReadMessage :one
UPDATE messages SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND organization_id=$2 AND expires_at>now() RETURNING *;
-- name: DeleteMessage :execrows
WITH removed AS (DELETE FROM messages m WHERE m.id=$1 AND m.organization_id=$2 RETURNING m.provider_event_id)
UPDATE provider_events p SET payload_ciphertext=NULL WHERE p.id IN (SELECT provider_event_id FROM removed);
-- name: ExpireMessage :exec
DELETE FROM messages WHERE id=$1 AND expires_at<=now();
-- name: LeaseForIncoming :one
SELECT * FROM leases WHERE id=$1 FOR UPDATE;
-- name: ForgetProviderEvent :exec
UPDATE provider_events SET payload_ciphertext=NULL WHERE id=$1;
