#!/usr/bin/env bash
# Sauvegarde le projet sur GitHub (commit + push).
# Usage : npm run save
#         npm run save -- "Mon message de sauvegarde"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-KINGDEMON6700}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-kingdemon6700@gmail.com}"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

MSG="${1:-Sauvegarde Vex $(date '+%Y-%m-%d %H:%M')}"

echo "=== Vérification (les .env ne partent pas — ils sont ignorés) ==="
STATUS_LINES="$(git status --short)"
TOTAL=$(printf '%s\n' "$STATUS_LINES" | sed '/^$/d' | wc -l)
printf '%s\n' "$STATUS_LINES" | sed '/^$/d' | head -40
if [ "$TOTAL" -gt 40 ]; then
  echo "... et $((TOTAL - 40)) autres fichiers"
fi
echo ""

git add -A

if git diff --cached --quiet; then
  echo "Rien de nouveau à sauvegarder — déjà à jour sur GitHub."
  exit 0
fi

echo "=== Envoi sur GitHub ==="
git commit -m "$MSG"
git push origin HEAD

echo ""
echo "OK — sauvegarde terminée sur https://github.com/KINGDEMON6700/vexbot.fr"
