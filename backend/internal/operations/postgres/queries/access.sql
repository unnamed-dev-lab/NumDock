-- name: MembershipRole :one
SELECT role FROM memberships WHERE organization_id=$1 AND user_id=$2 FOR SHARE;
-- name: LockOperation :exec
SELECT pg_advisory_xact_lock(hashtextextended(sqlc.arg(lock_key)::text,0));
-- name: OperationResult :one
SELECT request_hash,response FROM operation_requests WHERE organization_id=$1 AND operation=$2 AND key=$3;
-- name: SaveOperation :exec
INSERT INTO operation_requests(organization_id,operation,key,request_hash,response) VALUES($1,$2,$3,$4,$5);
-- name: AuditOperation :exec
INSERT INTO operation_audit(organization_id,user_id,action,resource_id) VALUES($1,$2,$3,$4);
-- name: EmitEvent :one
INSERT INTO workspace_events(organization_id,type,resource_id) VALUES($1,$2,$3) RETURNING id;
-- name: EventsAfter :many
SELECT id,type,resource_id FROM workspace_events WHERE organization_id=$1 AND id>$2 ORDER BY id LIMIT 100;
-- name: NewIdentifier :one
SELECT gen_random_uuid()::text AS id;

-- name: ConsumeOperationLimit :one
INSERT INTO operation_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET
 attempts=CASE WHEN operation_limits.bucket=date_trunc('minute',now()) THEN operation_limits.attempts+1 ELSE 1 END,
 bucket=date_trunc('minute',now()) RETURNING attempts;
