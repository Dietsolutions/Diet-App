#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Database backup script — Diet Plan & Tracker
# Usage:
#   ./scripts/backup-db.sh                    # saves to ./backups/
#   ./scripts/backup-db.sh /path/to/output    # custom directory
#
# Uses pg_dump or Docker (if pg_dump version mismatch).
#
# Optional cron (weekly on a machine with matching pg_dump):
#   0 3 * * 0 /path/to/diet.sunny/scripts/backup-db.sh >> /var/log/diet-backup.log 2>&1
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

DIR="${1:-$(dirname "$0")/../backups}"
mkdir -p "$DIR"

ENV_FILE="$(dirname "$0")/../server/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set. Create server/.env or export it." >&2
  exit 1
fi

# pg_dump doesn't support Neon pooler query params; strip them
BACKUP_URL="${DATABASE_URL/&connection_limit=*/}"
BACKUP_URL="${BACKUP_URL/connection_limit=1&/}"
BACKUP_URL="${BACKUP_URL/connection_limit=1/}"

TS=$(date +%Y-%m-%d_%H%M%S)
FILE="$DIR/dietplan-${TS}.sql"

echo "→ Backing up database to ${FILE}..."

if command -v pg_dump &>/dev/null; then
  # Check version compatibility
  LOCAL_VER=$(pg_dump --version | grep -oP '\d+' | head -1)
  echo "  pg_dump version ${LOCAL_VER} — attempting dump"
  pg_dump --no-owner --no-acl --clean --if-exists "$BACKUP_URL" > "$FILE" 2>&1 || {
    echo "  pg_dump failed (likely version mismatch). Falling back to Docker..."
    docker run --rm postgres:17-alpine pg_dump --no-owner --no-acl --clean --if-exists "$BACKUP_URL" > "$FILE"
  }
elif command -v docker &>/dev/null; then
  echo "  Using Docker postgres:17-alpine pg_dump..."
  docker run --rm postgres:17-alpine pg_dump --no-owner --no-acl --clean --if-exists "$BACKUP_URL" > "$FILE"
else
  echo "ERROR: Neither pg_dump (matching PG 17) nor Docker available." >&2
  echo "Install a compatible pg_dump or use Neon console → Backup." >&2
  exit 1
fi

gzip "$FILE"
echo "→ Done: ${FILE}.gz ($(du -h "${FILE}.gz" | cut -f1))"

# Keep last 8 backups (~8 weeks at weekly cadence)
find "$DIR" -name 'dietplan-*.sql.gz' -mtime +56 -delete
