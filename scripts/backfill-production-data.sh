#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@mhp-hypnose.com}"
ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:?SEED_ADMIN_PASSWORD required}"

COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

echo "=== Production Data Backfill ==="
echo "API: $API_URL"
echo ""

echo "[1/7] Authenticating..."
curl -sf -c "$COOKIE_JAR" -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" > /dev/null
echo "  OK"

echo "[2/7] DigiForma full sync..."
SYNC=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/admin/sync/full")
echo "  $SYNC"

echo "[3/7] DigiForma import + remap..."
IMPORT=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/admin/sync/import")
echo "  Import: $IMPORT"
REMAP=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/admin/sync/remap-enrollments")
echo "  Remap: $REMAP"

echo "[4/7] Bexio sync..."
BEXIO=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/admin/sync/bexio")
echo "  $BEXIO"

echo "[5/7] Channel sync..."
CHANNELS=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/admin/sync/channels")
echo "  $CHANNELS"

echo "[6/7] Geocoding backfill..."
GEO=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/admin/geocoding/backfill")
echo "  $GEO"

echo "[7/7] Database backfills (SQL)..."
psql "$DATABASE_URL" <<'SQL'
-- Certifications from Accredible credentials
INSERT INTO certifications (user_id, certification_name, issuing_body, issued_at, expires_at, status, verification_url, certificate_image_url)
SELECT ac.user_id, ac.credential_name, COALESCE(ac.group_name, 'OMNI Hypnose® Suisse romande'),
  ac.issued_at::date, ac.expires_at::date,
  CASE WHEN ac.expires_at IS NOT NULL AND ac.expires_at < NOW() THEN 'expired' ELSE 'active' END,
  ac.url, ac.badge_url
FROM accredible_credentials ac
WHERE ac.user_id IS NOT NULL AND ac.credential_name IS NOT NULL
ON CONFLICT DO NOTHING;

-- Mark enrollments completed where user has matching Accredible credential
WITH credential_program_map AS (
  SELECT DISTINCT ac.user_id, po.program_code
  FROM accredible_credentials ac
  JOIN program_overrides po ON (
    LOWER(ac.group_name) = LOWER(po.display_name)
    OR LOWER(ac.group_name) LIKE '%' || LOWER(po.program_code) || '%'
    OR LOWER(ac.group_name) LIKE '%' || LOWER(po.display_name) || '%'
  )
  WHERE ac.user_id IS NOT NULL
)
UPDATE program_enrollments pe
SET status = 'completed', updated_at = NOW()
FROM credential_program_map cpm
WHERE pe.user_id = cpm.user_id AND pe.program_code = cpm.program_code AND pe.status = 'active';

-- Upgrade directory visibility for users with directory-granting credentials
WITH qualified_users AS (
  SELECT DISTINCT pe.user_id
  FROM program_enrollments pe
  JOIN program_feature_grants pfg ON pfg.program_code = pe.program_code AND pfg.feature_key = 'directory'
  WHERE pe.status = 'completed'
)
UPDATE user_profiles up
SET directory_visibility = 'internal', updated_at = NOW()
FROM qualified_users qu
WHERE up.user_id = qu.user_id AND up.directory_visibility = 'hidden';
SQL
echo "  OK"

echo ""
echo "=== Backfill Complete ==="
echo "Run verification: psql \$DATABASE_URL -c \"SELECT tablename, (xpath('/row/cnt/text()', xml_count))[1]::text::int as count FROM (SELECT tablename, query_to_xml('SELECT count(*) as cnt FROM ' || tablename, false, false, '') as xml_count FROM pg_tables WHERE schemaname='public') t ORDER BY count DESC;\""
