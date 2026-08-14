#!/usr/bin/env bash
#
# staging-push-vps-agosto.sh
# ============================
# Push del delta de agosto (4 migraciones) al Supabase del VPS.
# Implementa docs/prompts-db/staging-push-vps-agosto.md.
#
# REGLAS:
#   - EJECUTAR DENTRO DE LA SESIÓN SSH DEL VPS (NUNCA en PowerShell local).
#   - El password de la DB se pide con read -rs (no queda en historial) y
#     NUNCA se tipea inline en comandos.
#   - NO usar vps_key.pem (está trackeada en git). Acceso con llave rotada.
#   - Backup previo es OBLIGATORIO y bloqueante.
#   - Solo `supabase db push`. Nunca SQL a mano en el SQL editor de Studio.
#
# Uso: bash staging-push-vps-agosto.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuración (ajustar si el repo vive en otro path del VPS)
# ---------------------------------------------------------------------------
STACKID="${STACKID:-qh5a6xd5ju7302obz5ozb74n}"          # stack id de Coolify
DB_HOST="${DB_HOST:-supabase-db}"                       # alias interno de red
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
CONTAINER="supabase-db-${STACKID}"
NETWORK="${STACKID}"
REPO_DIR="${REPO_DIR:-/root/Mediacion}"                 # ruta del repo en el VPS
BRANCH="${BRANCH:-feat/supabase-db}"
BACKUP_DIR="/root/backups"
ENV_DB="/root/.env-db"                                  # env file del push (R4)
VERIFY_ENV="/root/.env-verify"                          # env file de verificación
DBURL_BASE="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Estado remoto esperado ANTES del push (verificado el 2026-08)
EXPECTED_MIGS="23"
EXPECTED_LAST="20260730180000_backend_gap_features"
EXPECTED_TABLES="22"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

# Guard: solo corre en el VPS con el stack presente
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: contenedor ${CONTAINER} no encontrado."
  echo "Esto debe correrse dentro de la sesión SSH del VPS (169.58.88.64)."
  exit 1
fi

psql_q() { # psql_q <sql>  → query de solo lectura contra la DB del proyecto
  docker exec -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -Atc "$1"
}

# ---------------------------------------------------------------------------
# Tarea 0 — Credenciales (R1 y R4)
# ---------------------------------------------------------------------------
say "Tarea 0: credenciales"
if [[ -z "${PGPASSWORD:-}" ]]; then
  read -r -s -p "Password de la DB (SERVICE_PASSWORD_POSTGRES / POSTGRES_PASSWORD): " PGPASSWORD
  echo
  export PGPASSWORD
fi
if [[ -z "${PGPASSWORD}" ]]; then
  echo "ERROR: password vacío. Abortando."; exit 1
fi
# AVISO: si el password contiene caracteres especiales de URL (@ : / %), el
# --db-url de libpq puede romperse; en ese caso codificar o usar la variante
# con SUPABASE_DB_URL del stack (ver tarea 3).

# ---------------------------------------------------------------------------
# Tarea 1 — Backup previo (OBLIGATORIO y bloqueante)
# ---------------------------------------------------------------------------
say "Tarea 1: backup previo"
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
DUMP_NAME="backup_pre_push_${TS}.dump"
DUMP_PATH="$BACKUP_DIR/$DUMP_NAME"
docker exec -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "/tmp/${DUMP_NAME}"
docker cp "$CONTAINER:/tmp/${DUMP_NAME}" "$DUMP_PATH"
docker exec "$CONTAINER" rm -f "/tmp/${DUMP_NAME}"
chmod 600 "$DUMP_PATH"
echo "Backup tomado: $DUMP_PATH"

read -r -p "¿Cifrar con gpg (AES256) para bajarlo a una máquina local? [y/N] " enc
if [[ "$enc" =~ ^[Yy]$ ]]; then
  gpg --symmetric --cipher-algo AES256 "$DUMP_PATH"
  echo "Cifrado: ${DUMP_PATH}.gpg  → transferirlo con scp y borrar el plano:"
  echo "  rm ${DUMP_PATH}"
fi

# ---------------------------------------------------------------------------
# Tarea 2 — Pre-flight remoto
# ---------------------------------------------------------------------------
say "Tarea 2: pre-flight remoto"
echo "Contenedores supabase-db- en este host y sus tablas en public:"
for c in $(docker ps --format '{{.Names}}' | grep '^supabase-db-'); do
  n=$(docker exec -e PGPASSWORD="$PGPASSWORD" "$c" \
        psql -U "$DB_USER" -d "$DB_NAME" -Atc \
        "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
  echo "  $c -> $n tablas"
done
read -r -p "¿Confirmás que la instancia del proyecto es ${CONTAINER}? [y/N] " ok
[[ "$ok" =~ ^[Yy]$ ]] || { echo "Abortado."; exit 1; }

MIGS="$(psql_q "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
LAST="$(psql_q "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;")"
TABLES="$(psql_q "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
echo "Remoto actual: schema_migrations=$MIGS | última=$LAST | tablas_public=$TABLES"
echo "Esperado:      $EXPECTED_MIGS | $EXPECTED_LAST | $EXPECTED_TABLES"
if [[ "$MIGS" != "$EXPECTED_MIGS" ]] || [[ "$LAST" != "$EXPECTED_LAST" ]] \
   || [[ "$TABLES" != "$EXPECTED_TABLES" ]]; then
  echo "⚠️  El estado remoto NO coincide con lo esperado. Revisar antes de continuar."
  read -r -p "¿Continuar igual? [y/N] " ok2
  [[ "$ok2" =~ ^[Yy]$ ]] || { echo "Abortado."; exit 1; }
fi

# Repo en el VPS
if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "El repo no está clonado en $REPO_DIR."
  echo "Clonar (repo privado, requiere PAT de GitHub):"
  echo "  git clone --branch $BRANCH https://<PAT>@github.com/MagneStudios/Mediacion $REPO_DIR"
  read -r -p "Presioná Enter cuando esté clonado, o Ctrl-C para abortar." _
else
  git -C "$REPO_DIR" fetch origin "$BRANCH"
  git -C "$REPO_DIR" checkout "$BRANCH"
  git -C "$REPO_DIR" pull origin "$BRANCH"
fi
echo "Migraciones de agosto en el repo:"
ls -1 "$REPO_DIR"/supabase/migrations/202608*.sql

# ---------------------------------------------------------------------------
# Tarea 3 — Push del delta (solo `supabase db push`)
# ---------------------------------------------------------------------------
say "Tarea 3: supabase db push"
# R4: password vía env-file → no queda en `ps` ni en el historial.
printf 'SUPABASE_DB_URL=postgresql://%s:%s@%s:%s/%s?sslmode=disable\n' \
  "$DB_USER" "$PGPASSWORD" "$DB_HOST" "$DB_PORT" "$DB_NAME" > "$ENV_DB"
chmod 600 "$ENV_DB"
docker run --rm \
  --network "$NETWORK" \
  --env-file "$ENV_DB" \
  -v "$REPO_DIR":/repo \
  -w /repo \
  supabase/cli db push
echo "db push terminó. Si el CLI se queja por major_version, ajustar config.toml en $REPO_DIR (gotcha 5)."

# ---------------------------------------------------------------------------
# Tarea 4 — Verificación remota
# ---------------------------------------------------------------------------
say "Tarea 4: verificación"

echo "-- 4.1 Conteos --"
MIGS="$(psql_q "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
TABLES="$(psql_q "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
echo "schema_migrations=$MIGS (esperado 27)"
echo "tablas_public=$TABLES (esperado 24, con facturas y envios_email)"
echo "-- Versiones de agosto registradas --"
psql_q "SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '202608%' ORDER BY version;"
[[ "$MIGS" == "27" ]] || { echo "ERROR: no son 27 versiones."; exit 1; }
[[ "$TABLES" == "24" ]] || { echo "ERROR: no son 24 tablas."; exit 1; }

# Env file compartido por los contenedores de verificación (password sin exponer)
printf 'DATABASE_URL=%s?sslmode=disable\nPGPASSWORD=%s\n' "$DBURL_BASE" "$PGPASSWORD" > "$VERIFY_ENV"
chmod 600 "$VERIFY_ENV"

PYIMG="${PYIMG:-python:3.12-alpine}"
run_python() { # run_python <script> [montar tmp]
  local mount_tmp="${1:-}"
  local args=(--rm --network "$NETWORK"
              -v "$REPO_DIR/scripts":/scripts:ro
              -v "$REPO_DIR/requirements-dev.txt":/requirements.txt:ro
              --env-file "$VERIFY_ENV")
  if [[ "$mount_tmp" == "tmp" ]]; then
    args+=(-v "$REPO_DIR/tmp":/tmp_fixtures:ro)
  fi
  # alpine es musl: psycopg2-binary (glibc) puede no instalar → fallback a slim.
  if ! docker run "${args[@]}" "$PYIMG" \
         sh -c "pip install -q -r /requirements.txt && python $2"; then
    echo "Falló con $PYIMG; reintentando con python:3.12-slim (glibc)."
    docker run "${args[@]}" python:3.12-slim \
      sh -c "pip install -q -r /requirements.txt && python $2"
  fi
}

echo "-- 4.2 smoke_migrations.py (esperado 66/66) --"
run_python "" "/scripts/smoke_migrations.py"

echo "-- 4.3 validate_rls.py (esperado 17/17) --"
# Fixtures de tmp/ aplicados SOLO si faltan (idempotente sobre staging).
run_fixture() { # run_fixture <check-sql> <file> <desc>
  local n
  n="$(psql_q "$1")"
  if [[ "$n" != "0" ]]; then
    echo "  [skip] $3 (ya presente, $n)."
  else
    echo "  [run] $3"
    docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" \
      psql -U "$DB_USER" -d "$DB_NAME" -f - < "$REPO_DIR/tmp/$2"
  fi
}
run_fixture \
  "SELECT count(*) FROM auth.users WHERE email IN ('partea@test.com','parteb@test.com','mediador@test.com','admin@test.com','no_parte@test.com');" \
  "test_01_setup.sql" "usuarios de test"
run_fixture \
  "SELECT count(*) FROM casos WHERE nombre = 'Custodia de hijos menores';" \
  "test_02_caso.sql" "caso de test"
run_fixture \
  "SELECT count(*) FROM items WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores' LIMIT 1);" \
  "test_03_items.sql" "items de test"
run_python "tmp" "/scripts/validate_rls.py"

echo "-- 4.4 API (opcional, si la API corre en Coolify) --"
echo "Probe de escritura para ejercitar los triggers de auditoría:"
echo "  curl -s -X POST https://<api-host>/casos -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    -H 'Content-Type: application/json' -d '{\"nombre\":\"probe\",\"metodo\":\"negociacion\"}'"
echo "  → 201 {\"id\":\"…\",\"estado\":\"nuevo\"} = triggers OK"

# ---------------------------------------------------------------------------
# Tarea 5 — Rollback (solo si el push falló a mitad)
# ---------------------------------------------------------------------------
say "Tarea 5: rollback (referencia)"
echo "Si el push falló a mitad, revisar schema_migrations y, ante la duda, restaurar:"
echo "  docker exec -i -e PGPASSWORD=\"\$PGPASSWORD\" $CONTAINER \\"
echo "    pg_restore -U $DB_USER -d $DB_NAME --clean --if-exists < $DUMP_PATH"

# ---------------------------------------------------------------------------
# Limpieza y changelog
# ---------------------------------------------------------------------------
say "Limpieza"
rm -f "$ENV_DB" "$VERIFY_ENV"
echo "Env files temporales borrados. Backups: $BACKUP_DIR"

say "Changelog obligatorio"
echo "Registrar el resultado en docs/changelogs-db/2026-08-13.md (sección Pendientes → resuelta)"
echo "o crear un changelog nuevo con la fecha de ejecución, indicando:"
echo "  - backup tomado (nombre/ubicación: $DUMP_PATH)"
echo "  - resultado del push (4 migraciones y sus versiones)"
echo "  - verificación remota (27 versiones / 24 tablas / smoke / validate_rls)"
echo "  - incidentes o rollback si los hubo"

echo
echo "=== FIN — revisar las salidas de smoke (66/66) y validate_rls (17/17) ==="
