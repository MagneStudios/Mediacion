#!/usr/bin/env bash
#
# provision-produccion-vps.sh
# ===========================
# Provisiona el stack de PRODUCCIÓN (Supabase self-hosted en Coolify, stack
# separado del de prueba) según docs/db-produccion-vps.md.
#
# REGLAS:
#   - EJECUTAR DENTRO DE LA SESIÓN SSH DEL VPS (NUNCA en PowerShell local).
#   - Password del stack nuevo se pide con read -rs (no queda en historial).
#   - Backup del stack nuevo antes del restore (Tarea 4) y post-provisión.
#   - Solo migraciones por el loop psql + registro (docs/db-push-remoto.md).
#   - Nunca resets ni DROP en el stack de prueba (tiene datos reales).
#
# Uso: bash provision-produccion-vps.sh
#
set -euo pipefail

STACKID_PROD="${STACKID_PROD:-}"                         # stack id del stack NUEVO
SRC_CONTAINER="${SRC_CONTAINER:-supabase-db-qh5a6xd5ju7302obz5ozb74n}"  # prueba
DB_USER="${DB_USER:-supabase_admin}"
DB_NAME="${DB_NAME:-postgres}"
REPO_DIR="${REPO_DIR:-/root/mediacion-repo}"
BACKUP_DIR="/root/backups"
TS="$(date +%Y%m%d_%H%M%S)"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

if [[ -z "$STACKID_PROD" ]]; then
  echo "ERROR: definir STACKID_PROD del stack de producción"
  echo "  export STACKID_PROD=<stackid> && bash provision-produccion-vps.sh"
  exit 1
fi
CONTAINER="supabase-db-${STACKID_PROD}"
NETWORK="$STACKID_PROD"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: contenedor ${CONTAINER} no encontrado. Crear el stack en Coolify primero."
  exit 1
fi

if [[ -z "${PGPASSWORD_PROD:-}" ]]; then
  read -r -s -p "Password del stack NUEVO (POSTGRES_PASSWORD): " PGPASSWORD_PROD
  echo
  export PGPASSWORD_PROD
fi
[[ -z "$PGPASSWORD_PROD" ]] && { echo "ERROR: password vacío."; exit 1; }

if [[ -z "${PGPASSWORD_SRC:-}" ]]; then
  read -r -s -p "Password del stack de PRUEBA (origen de datos): " PGPASSWORD_SRC
  echo
  export PGPASSWORD_SRC
fi
[[ -z "$PGPASSWORD_SRC" ]] && { echo "ERROR: password vacío."; exit 1; }

psql_prod() { docker exec -e PGPASSWORD="$PGPASSWORD_PROD" "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -Atc "$1"; }
psql_src()  { docker exec -e PGPASSWORD="$PGPASSWORD_SRC"  "$SRC_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -Atc "$1"; }

# ---------------------------------------------------------------------------
# Tarea 1 — Pre-flight
# ---------------------------------------------------------------------------
say "Tarea 1: pre-flight del stack nuevo"
echo "Contenedores supabase-db- en este host y tablas en public:"
for c in $(docker ps --format '{{.Names}}' | grep '^supabase-db-'); do
  n=$(docker exec -e PGPASSWORD="$PGPASSWORD_PROD" "$c" psql -U "$DB_USER" -d "$DB_NAME" -Atc \
      "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null || echo "?" )
  echo "  $c -> $n tablas"
done
read -r -p "¿Confirmás que el stack de producción es ${CONTAINER}? [y/N] " ok
[[ "$ok" =~ ^[Yy]$ ]] || { echo "Abortado."; exit 1; }

TABLES="$(psql_prod "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
echo "public del stack nuevo: $TABLES tablas (esperado 0 o solo base)."
if [[ "$TABLES" != "0" ]]; then
  read -r -p "public no está vacío. ¿Continuar igual? [y/N] " ok2
  [[ "$ok2" =~ ^[Yy]$ ]] || { echo "Abortado."; exit 1; }
fi

# ---------------------------------------------------------------------------
# Tarea 2 — Aplicar las 28 migraciones (loop psql + registro)
# ---------------------------------------------------------------------------
say "Tarea 2: migraciones"
for f in $(ls -1 "$REPO_DIR"/supabase/migrations/*.sql | sort); do
  v="$(basename "$f" .sql)"
  if [[ -n "$(psql_prod "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$v';")" ]]; then
    echo "  [skip] $v"
    continue
  fi
  echo "  [apply] $v"
  docker exec -i -e PGPASSWORD="$PGPASSWORD_PROD" "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f - < "$f"
  psql_prod "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$v', '${v#*_}');"
done
MIGS="$(psql_prod "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "Versiones registradas: $MIGS (esperado 28)"

# ---------------------------------------------------------------------------
# Tarea 3 — Backup del stack nuevo (pre-restore)
# ---------------------------------------------------------------------------
say "Tarea 3: backup pre-restore"
mkdir -p "$BACKUP_DIR"
docker exec -e PGPASSWORD="$PGPASSWORD_PROD" "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "/tmp/prod_pre_${TS}.dump"
docker cp "$CONTAINER:/tmp/prod_pre_${TS}.dump" "$BACKUP_DIR/prod_pre_${TS}.dump"
docker exec "$CONTAINER" rm -f "/tmp/prod_pre_${TS}.dump"
chmod 600 "$BACKUP_DIR/prod_pre_${TS}.dump"
echo "Backup: $BACKUP_DIR/prod_pre_${TS}.dump"

# ---------------------------------------------------------------------------
# Tarea 4 — Copia de datos reales desde el stack de prueba
# ---------------------------------------------------------------------------
say "Tarea 4: copia de datos reales (stack de prueba -> producción)"
DUMP_DATA="/tmp/data_${TS}.dump"
docker exec -e PGPASSWORD="$PGPASSWORD_SRC" "$SRC_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --data-only --disable-triggers \
  --exclude-table-data=supabase_migrations.schema_migrations \
  -f "$DUMP_DATA"
docker cp "$SRC_CONTAINER:$DUMP_DATA" "$BACKUP_DIR/data_${TS}.dump"
docker exec "$SRC_CONTAINER" rm -f "$DUMP_DATA"
chmod 600 "$BACKUP_DIR/data_${TS}.dump"
echo "Dump de datos: $BACKUP_DIR/data_${TS}.dump"

docker exec -i -e PGPASSWORD="$PGPASSWORD_PROD" "$CONTAINER" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --data-only --disable-triggers \
  --no-owner --exit-on-error < "$BACKUP_DIR/data_${TS}.dump"
echo "Restore de datos completo."

# ---------------------------------------------------------------------------
# Tarea 5 — Limpieza de fixtures (confirmación interactiva)
# ---------------------------------------------------------------------------
say "Tarea 5: limpieza de fixtures de test"
echo "Conteos previos en el stack de PRODUCCIÓN:"
psql_prod "SELECT count(*) FROM auth.users;"
psql_prod "SELECT email FROM auth.users ORDER BY email;"

read -r -p "¿Borrarlos? (partea@test.com, dev@*, probes, casos de test) [y/N] " ok3
if [[ "$ok3" =~ ^[Yy]$ ]]; then
  docker exec -i -e PGPASSWORD="$PGPASSWORD_PROD" "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM items WHERE caso_id IN
  (SELECT id FROM casos WHERE nombre IN ('Custodia de hijos menores','Caso aislado'));
DELETE FROM caso_partes WHERE caso_id IN
  (SELECT id FROM casos WHERE nombre IN ('Custodia de hijos menores','Caso aislado'));
DELETE FROM casos WHERE nombre IN ('Custodia de hijos menores','Caso aislado');
DELETE FROM suscripciones WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM auth.users WHERE email IN (
  'partea@test.com','parteb@test.com','mediador@test.com','admin@test.com',
  'no_parte@test.com','estudio@test.com','claude-verify-probe@example.com',
  'dev@mediacion.test','dev@solmi.test','prueba+e616634@solmi.test',
  'parteb-1785422205@solmi.test');
SQL
  echo "Fixtures borrados."
else
  echo "Limpieza omitida (decisión del operador)."
fi

# ---------------------------------------------------------------------------
# Tarea 6 — Verificación
# ---------------------------------------------------------------------------
say "Tarea 6: verificación"
MIGS="$(psql_prod "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
TABLES="$(psql_prod "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
FIXTURES="$(psql_prod "SELECT count(*) FROM auth.users WHERE email LIKE '%@test.com' OR email LIKE 'dev@%' OR email LIKE '%verify-probe%';")"
echo "schema_migrations=$MIGS (esperado 28)"
echo "tablas_public=$TABLES (esperado 24)"
echo "fixtures restantes=$FIXTURES (esperado 0)"

printf 'DATABASE_URL=postgresql://%s:%s@supabase-db:5432/%s?sslmode=disable\n' \
  "$DB_USER" "$PGPASSWORD_PROD" "$DB_NAME" > /root/.env-verify
chmod 600 /root/.env-verify
docker run --rm --network "$NETWORK" \
  -v "$REPO_DIR/scripts":/scripts:ro \
  -v "$REPO_DIR/requirements-dev.txt":/requirements.txt:ro \
  --env-file /root/.env-verify \
  python:3.12-slim sh -c "pip install -q -r /requirements.txt && python /scripts/smoke_migrations.py"
rm -f /root/.env-verify

[[ "$MIGS" == "28" ]] || { echo "ERROR: versiones != 28."; exit 1; }
[[ "$TABLES" == "24" ]] || { echo "ERROR: tablas != 24."; exit 1; }

# ---------------------------------------------------------------------------
# Tarea 7 — Backup post-provisión
# ---------------------------------------------------------------------------
say "Tarea 7: backup post-provisión"
docker exec -e PGPASSWORD="$PGPASSWORD_PROD" "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "/tmp/prod_post_${TS}.dump"
docker cp "$CONTAINER:/tmp/prod_post_${TS}.dump" "$BACKUP_DIR/prod_post_${TS}.dump"
docker exec "$CONTAINER" rm -f "/tmp/prod_post_${TS}.dump"
chmod 600 "$BACKUP_DIR/prod_post_${TS}.dump"
echo "Backup: $BACKUP_DIR/prod_post_${TS}.dump"

say "FIN — stack de producción provisionado"
echo "Pendientes manuales: apuntar DATABASE_URL de la API, backups cron,"
echo "revisar usuarios reales, y registrar el resultado en docs/changelogs-db/."
