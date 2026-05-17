#!/usr/bin/env bash
set -euo pipefail

DB_PATH="/home/localvps/app/Vex/api/prisma/dev.db"
BACKUP_DIR="/home/localvps/backups/vexbot"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/dev-$STAMP.db"

# Keep the latest 14 backups.
ls -1t "$BACKUP_DIR"/dev-*.db 2>/dev/null | sed -n '15,$p' | xargs -r rm -f
