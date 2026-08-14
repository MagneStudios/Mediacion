# Prompt — Staging: push del delta de agosto al Supabase del VPS

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación". Seguís el pipeline: **DBML → migraciones (RLS/triggers) → scripts Python → QA/E2E → staging → producción en Supabase**. Stack: PostgreSQL 17, Supabase self-hosted en el VPS (Coolify), CLI de Supabase como contenedor Docker atado a la red interna del stack (ver `docs/db-push-remoto.md`).

**Entorno:** el VPS es **producción-de-prueba** (entorno de testing, no la versión final). El procedimiento es el estándar, pero con **backup obligatorio antes de tocar nada**.

## Estado (verificado)

| Ámbito | Estado |
|--------|--------|
| Local | 27 migraciones validadas: 66/66 smoke, 17/17 validate_rls, `supabase db lint` 0, 896 tests API |
| Remoto (VPS Coolify) | 22 tablas viejas, sin migraciones de agosto |
| Delta a aplicar | 4 archivos: `20260810120000_cambios_reunion_07_08.sql`, `20260811130000_linter_security_revoke.sql`, `20260811140000_linter_perf_consolidate_policies.sql`, `20260811150000_linter_perf_fk_indexes.sql` |
| Repo | `origin/feat/supabase-db` sincronizada con el local |

## Precondiciones

- Acceso SSH al VPS (`169.58.88.64`).
- Identificar la instancia del proyecto: stack id, contenedor `supabase-db-<stackid>`, password (`SERVICE_PASSWORD_POSTGRES` / `POSTGRES_PASSWORD` del stack) y red Docker del stack.
- **Regla:** no tocar instancias de otros proyectos — verificar siempre cuál es la propia antes de migrar (comparar el contenido de `public` si hay ambigüedad, Parte 0 de `docs/db-push-remoto.md`).
- **Credenciales (R1):** ejecutar todos los comandos Docker dentro de la sesión SSH del VPS, nunca en PowerShell local. El password de la DB se obtiene de las env vars del stack en Coolify (`SERVICE_PASSWORD_POSTGRES` / `POSTGRES_PASSWORD`) o con `read -rs` en la sesión — **nunca** tipeado inline en comandos (queda en `ConsoleHost_history.txt` de tu PC y en el historial bash del VPS). Ver tarea 0.
- **Clave de acceso (R3):** `vps_key.pem` está **trackeada en el historial de git** — cualquiera con acceso al repo tiene la llave del VPS. **No usarla** para este acceso: usar una llave rotada recientemente (o password). Purgarla del historial y rotarla es tarea futura, fuera del alcance de este prompt.

## Tareas (en orden)

### 0. Preparación de credenciales (R1 y R4)

1. Abrir la sesión SSH al VPS. Todos los comandos Docker corren **en el VPS**.
2. Obtener el password de la DB sin exponerlo en historial:
   ```bash
   read -rs PW          # no queda en el historial de bash
   export PGPASSWORD="$PW"
   ```
3. A partir de acá, **todos los `<PW>` del documento equivalen a `"$PGPASSWORD"`** — reemplazá el placeholder por la variable de la sesión, nunca por el valor literal tipeado.
4. Si el stack expone `SUPABASE_DB_URL` en las env vars de Coolify (R4), pasarla al contenedor vía `--env-file` para que el password no quede en `ps` ni en el historial:
   ```bash
   printf 'SUPABASE_DB_URL=postgresql://postgres:%s@supabase-db:5432/postgres?sslmode=disable\n' "$PW" > /root/.env-db
   chmod 600 /root/.env-db
   docker run --rm --network <stackid> --env-file /root/.env-db \
     -v /root/<repo>:/repo -w /repo supabase/cli db push
   ```
5. Al terminar la sesión: borrar `/root/.env-db` y limpiar el historial local (`Clear-History`) si quedó algo.

### 1. Backup previo (obligatorio)

```bash
docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> \
  pg_dump -U postgres -d postgres -Fc -f /tmp/backup_pre_push.dump
docker cp supabase-db-<stackid>:/tmp/backup_pre_push.dump /root/backups/
```

Guardar una copia del dump fuera del VPS si es posible. **R2 — el dump contiene datos reales de casos de mediación (información sensible):**

- Si se baja a una máquina local, **cifrarlo antes de transferirlo**:
  ```bash
  gpg --symmetric --cipher-algo AES256 /root/backups/backup_pre_push.dump   # pide passphrase
  scp /root/backups/backup_pre_push.dump.gpg <usuario>@<tu-mac>:~/backups/
  rm /root/backups/backup_pre_push.dump   # borrar el plano tras cifrar
  ```
- Si se deja solo en el VPS: `chmod 600 /root/backups/backup_pre_push.dump` y anotar la ruta en el changelog.
- El `.gpg` se puede borrar del VPS una vez confirmada la copia local.

### 2. Pre-flight remoto

```bash
docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
# → 23 filas, última: 20260730180000_backend_gap_features

docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
# → 22
```

Actualizar el repo en el VPS:

```bash
git -C /root/<repo> pull origin feat/supabase-db
```

### 3. Push del delta

```bash
docker run --rm \
  --network <stackid> \
  -v /root/<repo>:/repo \
  -w /repo \
  supabase/cli db push \
  --db-url "postgresql://postgres:<PW>@supabase-db:5432/postgres?sslmode=disable"
```

`db push` aplica solo las versiones pendientes (las 4 de agosto) y las registra en `supabase_migrations.schema_migrations`. Idempotente.

**R4:** si `SUPABASE_DB_URL` está disponible en el stack, preferir la variante con `--env-file` de la tarea 0 (el password no aparece en `ps`). Si no, el comando inline queda como arriba pero siempre con `$PGPASSWORD` — nunca con el valor literal.

### 4. Verificación remota

**4.1 Conteos**

```bash
docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations;"
# → 27

docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
# → 24 (facturas y envios_email presentes)
```

**4.2 `smoke_migrations.py` (66/66)** — el puerto 5432 no está publicado; correr el script dentro de la red del stack en un contenedor throwaway:

```bash
docker run --rm \
  --network <stackid> \
  -v /root/<repo>/scripts:/scripts:ro \
  -v /root/<repo>/requirements-dev.txt:/requirements.txt:ro \
  -e DATABASE_URL="postgresql://postgres:<PW>@supabase-db:5432/postgres" \
  python:3.12-alpine sh -c "pip install -q -r /requirements.txt && python /scripts/smoke_migrations.py"
```

**4.3 `validate_rls.py` (17/17)** — requiere los fixtures de usuarios/caso de `tmp/test_01_setup.sql` (idéntico a `setup_test_env.ps1` en local). Montar `tmp/` en el contenedor, correr el setup y después el script:

```bash
docker run --rm \
  --network <stackid> \
  -v /root/<repo>/scripts:/scripts:ro \
  -v /root/<repo>/tmp:/tmp:ro \
  -v /root/<repo>/requirements-dev.txt:/requirements.txt:ro \
  -e DATABASE_URL="postgresql://postgres:<PW>@supabase-db:5432/postgres" \
  python:3.12-alpine sh -c "pip install -q -r /requirements.txt \
    && PGPASSWORD='<PW>' psql 'postgresql://postgres@supabase-db:5432/postgres' -f /tmp/test_01_setup.sql \
    && python /scripts/validate_rls.py"
```

> Si no hay `psql` en el contenedor python, ejecutar el fixture con `docker exec` sobre `supabase-db-<stackid>` (como en `setup_test_env.ps1`) y correr solo `validate_rls.py` en el contenedor throwaway.

**4.4 Check de API (opcional, si la API ya corre en Coolify)** — el probe de escritura ejercita el trigger de auditoría sobre la DB migrada (`docs/deploy-coolify.md` §4):

```bash
curl -s -X POST https://<api-host>/casos -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"nombre":"probe","metodo":"negociacion"}'
# → 201 {"id":"…","estado":"nuevo"} = triggers OK
```

### 5. Rollback (solo si el push falla a mitad)

```bash
docker exec -i -e PGPASSWORD='<PW>' supabase-db-<stackid> \
  pg_restore -U postgres -d postgres --clean --if-exists < /root/backups/backup_pre_push.dump
```

Si el push falló, **revisar `schema_migrations` antes de reintentar**; ante la duda, restore del backup.

## Reglas estrictas

1. **Backup antes de cualquier push** (tarea 1 es bloqueante).
2. Confirmar que la instancia es la del proyecto — no tocar instancias ajenas.
3. Solo `supabase db push`. **Nunca** SQL a mano por el SQL editor de Studio (no registra versiones → el próximo push falla con "already exists") ni `scripts/apply-migrations.sh` (corre el shim de CI y no registra versiones).
4. No publicar el puerto 5432; el contenedor CLI corre dentro de la red interna del stack.
5. Gotcha de `major_version` (local 17 vs remoto): para `db push` no bloquea; si el CLI se queja, ajustar `config.toml` en el repo del VPS.
6. Revocar el PAT de GitHub al terminar si se usó para clone/pull.
7. **(R3)** No usar `vps_key.pem` para este acceso: está trackeada en git. Usar una llave rotada. Purgarla del historial + rotarla queda como tarea futura.
8. **(R4)** No repetir el password en `PGPASSWORD` y `--db-url`: priorizar `SUPABASE_DB_URL` del stack vía `--env-file`. Todos los placeholders `<PW>` se sustituyen por `$PGPASSWORD` de la sesión, nunca por el valor literal.
9. **(R2)** El dump nunca viaja sin cifrar fuera del VPS.

## Criterio de aceptación

- `schema_migrations`: **27 filas**, con las 4 versiones de agosto registradas.
- `pg_tables` en `public`: **24**, incluidas `facturas` y `envios_email`.
- `smoke_migrations.py` **66/66** y `validate_rls.py` **17/17** contra el remoto (o validación SQL equivalente documentada).
- Sin regresión en la API que ya corre (health + probe de escritura si aplica).

## Changelog obligatorio (no cerrar sin esto)

Al finalizar la ejecución, actualizar `docs/changelogs-db/2026-08-13.md` (sección "Pendientes" → marcarla resuelta) **o** crear el changelog con la fecha de ejecución en el mismo formato (`# Changelog — Proyecto Mediación`, sección por fecha, subsecciones con tablas), registrando: backup tomado (nombre/ubicación), resultado del push (4 migraciones, versiones), verificación remota (conteos + smoke/validate_rls) y cualquier incidente o rollback realizado.
