#!/usr/bin/env bash
# Applies the Supabase shim and every tracked migration, in order, to DATABASE_URL.
#
# Used by CI to build a real schema the integration suite can run against, and
# usable locally against a throwaway Postgres:
#
#   docker run -d --name mediacion-pg -e POSTGRES_PASSWORD=postgres \
#     -p 55432:5432 postgres:16-alpine
#   DATABASE_URL=postgresql://postgres:postgres@localhost:55432/postgres \
#     bash scripts/apply-migrations.sh
#
# Migrations come from `git ls-files`, not a glob, for two reasons: it guarantees
# CI applies exactly what is committed, and it skips the untracked `<name> 2.sql`
# duplicates macOS leaves behind — a glob would apply those a second time and
# fail on the first CREATE TYPE.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

command -v psql >/dev/null || { echo "psql not found on PATH" >&2; exit 1; }

# ON_ERROR_STOP is what makes this a gate rather than a log: without it psql
# reports failures and still exits 0.
run() { psql "$DATABASE_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$1"; }

echo "==> Supabase shim"
run supabase/ci/bootstrap.sql

# A committed "<name> 2.sql" duplicate applies its migration a second time and
# the run dies on `type ... already exists` — a confusing failure a long way from
# its cause. Fail here instead, naming the files.
duplicates=$(git ls-files 'supabase/migrations/*' | grep -E ' [0-9]+\.[a-z]+$' || true)
if [ -n "$duplicates" ]; then
  echo "ERROR: duplicate migration files are tracked:" >&2
  echo "$duplicates" | sed 's/^/  /' >&2
  echo "These are macOS copies. Remove them with: git rm --cached '<file>'" >&2
  exit 1
fi

count=0
while IFS= read -r file; do
  echo "==> $(basename "$file")"
  run "$file"
  count=$((count + 1))
done < <(git ls-files 'supabase/migrations/*.sql' | sort)

if [ "$count" -eq 0 ]; then
  echo "ERROR: no tracked migrations found under supabase/migrations/." >&2
  exit 1
fi

echo "==> applied $count migrations"
