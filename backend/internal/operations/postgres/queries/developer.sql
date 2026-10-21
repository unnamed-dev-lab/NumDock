-- name: CreateAPIKey :one
INSERT INTO api_keys(organization_id,user_id,name,prefix,token_hash,scopes,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *;
-- name: ListAPIKeys :many
SELECT id,name,prefix,scopes,created_at,expires_at,revoked_at,last_used_at FROM api_keys WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3;
-- name: CountAPIKeys :one
SELECT count(*) FROM api_keys WHERE organization_id=$1;
-- name: RevokeAPIKey :execrows
UPDATE api_keys SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND organization_id=$2;
-- name: AuthenticateAPIKey :one
UPDATE api_keys k SET last_used_at=now() FROM memberships m WHERE k.token_hash=$1 AND k.revoked_at IS NULL AND k.expires_at>now() AND m.user_id=k.user_id AND m.organization_id=k.organization_id RETURNING k.id,k.organization_id,k.user_id,k.scopes;
-- name: CreateWebhook :one
INSERT INTO webhook_endpoints(id,organization_id,url,secret_ciphertext) VALUES($1,$2,$3,$4) RETURNING *;
-- name: ListWebhooks :many
SELECT id,url,enabled,created_at FROM webhook_endpoints WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3;
-- name: CountWebhooks :one
SELECT count(*) FROM webhook_endpoints WHERE organization_id=$1;
-- name: SetWebhookEnabled :execrows
UPDATE webhook_endpoints SET enabled=$3 WHERE id=$1 AND organization_id=$2;
-- name: GetWebhook :one
SELECT * FROM webhook_endpoints WHERE id=$1 AND organization_id=$2 FOR SHARE;
-- name: ActiveWebhooks :many
SELECT id FROM webhook_endpoints WHERE organization_id=$1 AND enabled=true;
-- name: CreateDelivery :one
INSERT INTO webhook_deliveries(organization_id,endpoint_id,event_id) VALUES($1,$2,$3) RETURNING id;
-- name: DeliveryForWork :one
SELECT d.*,w.url,w.enabled,w.secret_ciphertext,e.type,e.resource_id FROM webhook_deliveries d JOIN webhook_endpoints w ON w.id=d.endpoint_id JOIN workspace_events e ON e.id=d.event_id WHERE d.id=$1 FOR UPDATE OF d;
-- name: RecordDelivery :exec
UPDATE webhook_deliveries SET status=$2,attempts=attempts+1,response_status=$3,updated_at=now(),next_attempt_at=$4 WHERE id=$1;
-- name: ListDeliveries :many
SELECT id,endpoint_id,event_id,status,attempts,response_status,created_at,updated_at FROM webhook_deliveries WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3;
-- name: CountDeliveries :one
SELECT count(*) FROM webhook_deliveries WHERE organization_id=$1;
