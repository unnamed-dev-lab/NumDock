-- name: ListCatalogItems :many
SELECT * FROM catalog_items
WHERE status='available' AND (sqlc.arg(country)::text = '' OR country_code = sqlc.arg(country))
  AND (sqlc.arg(number_type)::text = '' OR number_type = sqlc.arg(number_type))
  AND (sqlc.arg(capability)::text = '' OR sqlc.arg(capability) = ANY(capabilities))
  AND (sqlc.arg(use_case)::text = '' OR use_cases @> ARRAY[sqlc.arg(use_case)]::text[])
  AND (sqlc.arg(search)::text = '' OR strpos(lower(e164 || ' ' || country_name || ' ' || region || ' ' || provider || ' ' || array_to_string(use_cases, ' ')), lower(sqlc.arg(search))) > 0)
ORDER BY
  CASE WHEN sqlc.arg(sort_by)::text = 'e164' AND sqlc.arg(sort_order)::text = 'asc' THEN e164 END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'e164' AND sqlc.arg(sort_order)::text = 'desc' THEN e164 END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'monthly_fee_minor' AND sqlc.arg(sort_order)::text = 'asc' THEN monthly_fee_minor END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'monthly_fee_minor' AND sqlc.arg(sort_order)::text = 'desc' THEN monthly_fee_minor END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'inbound_sms_fee_micros' AND sqlc.arg(sort_order)::text = 'asc' THEN inbound_sms_fee_micros END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'inbound_sms_fee_micros' AND sqlc.arg(sort_order)::text = 'desc' THEN inbound_sms_fee_micros END DESC,
  id ASC
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountCatalogItems :one
SELECT count(*) FROM catalog_items
WHERE status='available' AND (sqlc.arg(country)::text = '' OR country_code = sqlc.arg(country))
  AND (sqlc.arg(number_type)::text = '' OR number_type = sqlc.arg(number_type))
  AND (sqlc.arg(capability)::text = '' OR sqlc.arg(capability) = ANY(capabilities))
  AND (sqlc.arg(use_case)::text = '' OR use_cases @> ARRAY[sqlc.arg(use_case)]::text[])
  AND (sqlc.arg(search)::text = '' OR strpos(lower(e164 || ' ' || country_name || ' ' || region || ' ' || provider || ' ' || array_to_string(use_cases, ' ')), lower(sqlc.arg(search))) > 0);
