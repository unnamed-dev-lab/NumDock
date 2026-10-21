-- name: HasOverviewMembership :one
SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND organization_id = $2);

-- name: ListOverviewDays :many
SELECT d.* FROM development_overview_daily d
JOIN memberships m ON m.organization_id = d.organization_id AND m.user_id = sqlc.arg(user_id)
WHERE d.organization_id = sqlc.arg(organization_id)
  AND d.day >= sqlc.arg(start_day)::date AND d.day <= sqlc.arg(end_day)::date
ORDER BY d.day;
