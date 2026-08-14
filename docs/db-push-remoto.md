# Push de migraciones al Supabase self-hosted (Coolify)

Cómo aplicar las migraciones de `supabase/migrations/*.sql` al Supabase self-hosted
que corre en el VPS (`169.58.88.64`) vía Coolify.

## Contexto

- Postgres corre **solo dentro de la red Docker de Coolify**: el puerto 5432 NO se
  publica a internet (postura de seguridad, ver `docs/deploy-coolify.md`).
- La DB se alcanza por el **hostname interno** (`supabase-db`, alias de red del stack),
  no por la IP pública.
- El usuario administrativo es **`supabase_admin`** (superuser, dueño de
  `supabase_migrations.schema_migrations`). **`postgres` NO es superuser** en los
  stacks de Coolify: no puede hacer DDL ni insertar en `schema_migrations`.
- La imagen Docker `supabase/cli` **NO existe en Docker Hub** (pull access denied).
  El CLI oficial se usa como binario (v2.x) descargado de GitHub releases
  (ver gotchas). El `db push` del CLI v2 no funciona contra este stack (exige
  project ref y no resuelve drifts de nombres), así que el método probado es
  **psql como `supabase_admin` + registro manual de versiones** (estado final
  idéntico al de `db push`).
- Nada de exponer 5432 ni túneles.

## Parte 0 — Identificar la instancia del proyecto

Cada stack de Supabase en Coolify genera nombres con un stack id:

| Elemento | Nombre |
|---|---|
| Contenedor de la DB | `supabase-db-<stackid>` |
| Red Docker del stack | `<stackid>` |
| Host interno | `supabase-db` (alias de red) |
| Puerto | `5432` |
| Base | `postgres` |

Para saber cuál es la instancia del proyecto:

- **Dominio de Kong o Studio** en Coolify: `supabasekong-<stackid>...` / `studio-<proyecto>...`
  te dan el stackid, **o**
- **Coolify → recurso de la API → `DATABASE_URL`**: el hostname interno (`supabase-db-<id>`),
  **o**
- Si hay varias instancias ambiguas, comparar el contenido:
  ```bash
  for c in $(docker ps --format '{{.Names}}' | grep '^supabase-db-'); do
    echo "== $c"
    docker exec -e PGPASSWORD='<PW>' $c psql -U supabase_admin -d postgres -Atc \
      "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
  done
  ```
  La que tenga el schema del proyecto (o los datos) es la correcta.

Datos necesarios de la instancia:

- **Stack ID / red** (ej. `qh5a6xd5ju7302obz5ozb74n`)
- **Contenedor** `supabase-db-<stackid>`
- **Password**: `POSTGRES_PASSWORD` del stack (compartido por `postgres` y
  `supabase_admin`), visible en las env vars del contenedor si no está en Coolify:
  `docker inspect <contenedor> --format "{{range .Config.Env}}{{println .}}{{end}}" | sed -n 's/^POSTGRES_PASSWORD=//p'`
- **Usuario**: `supabase_admin`. `postgres` NO sirve (no es superuser).

> **Regla**: no tocar instancias de otros proyectos. Verificá siempre cuál es la tuya
> antes de migrar.

## Parte 1 — Migraciones nuevas en proyecto existente

1. **Local**: pushear la rama que tiene las migraciones nuevas
   ```bash
   git push origin <rama>
   ```

2. **VPS**: obtener/actualizar el repo (clonado en `/root/mediacion-repo`)
   - Primera vez (repo privado, necesita PAT de GitHub):
     ```bash
     cd /root
     git clone --branch <rama> https://<PAT>@github.com/MagneStudios/Mediacion mediacion-repo
     ```
     El `--branch <rama>` es obligatorio: sin él se clona la rama default.
   - Ya clonado:
     ```bash
     git -C /root/mediacion-repo pull origin <rama>
     ```
   - `tmp/` está gitignored: si hacen falta fixtures (`test_*.sql`), copiarlos por scp.

3. **Pre-flight**: ver qué versiones están registradas en el remoto
   ```bash
   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U supabase_admin -d postgres -Atc \
     "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
   ```
   - Si da `relation ... does not exist`: es la primera migración (ver Parte 2 paso 4).
   - **Verificar que cada `version` coincida EXACTAMENTE con el nombre del archivo
     local** (sin `.sql`). Si hay drift (versiones registradas sin sufijo), alinear
     primero con `UPDATE ... SET version = ...` (ver gotchas).

4. **Push (psql + registro — método probado)**
   ```bash
   for f in $(ls -1 /root/mediacion-repo/supabase/migrations/*.sql | sort); do
     v="$(basename "$f" .sql)"
     done=$(docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> \
       psql -U supabase_admin -d postgres -Atc \
       "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$v';")
     [[ -n "$done" ]] && { echo "skip $v"; continue; }
     echo "apply $v"
     docker exec -i -e PGPASSWORD='<PW>' supabase-db-<stackid> \
       psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f - < "$f"
     docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> \
       psql -U supabase_admin -d postgres -Atc \
       "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$v', '${v#*_}');"
   done
   ```
   Aplica solo el delta, en orden, y registra cada versión (name = sufijo sin
   timestamp), igual que `db push`.

5. **Verificar**
   ```bash
   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U supabase_admin -d postgres -Atc \
     "SELECT count(*) FROM supabase_migrations.schema_migrations;"

   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U supabase_admin -d postgres -Atc \
     "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
   ```
   El count de versiones debe coincidir con `ls supabase/migrations/*.sql | wc -l`.

## Parte 2 — Proyecto nuevo (primera vez)

1. Crear el stack Supabase en Coolify (one-click) y anotar stackid/red/password
   (Parte 0).
2. Clonar el repo en el VPS (Parte 1, paso 2).
3. **Pre-flight**: el schema `public` debe estar vacío
   ```bash
   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U supabase_admin -d postgres -Atc \
     "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
   ```
   - Si da `0`, listo.
   - Si da > 0: el stack tiene otro schema (¿otro proyecto?) → NO tocar. Si se confirma
     que es el del proyecto y no hay datos que perder:
     ```sql
     DROP SCHEMA public CASCADE;
     CREATE SCHEMA public;
     ```
4. **Push** con el loop de la Parte 1 → aplica todas las migraciones en orden y
   crea el tracking.
5. **Verificar** con las mismas queries de la Parte 1.
6. **Grants**: si el stack arrancó con el ACL de `public` vacío (roles JWT sin
   USAGE), la migración `20260814160000_grants_schema_public.sql` lo restaura.

## Parte 3 — Gotchas (errores encontrados en la práctica)

| Problema | Solución |
|---|---|
| Imagen `supabase/cli` inexistente | Bajá el binario oficial de releases: `curl -sL https://github.com/supabase/cli/releases/download/v2.114.0/supabase_2.114.0_linux_amd64.tar.gz` → descomprimir en `/root/supabase-cli/`. No existe la imagen Docker. |
| CLI v2 `db push` falla ("Cannot find project ref" / "Remote migration versions not found") | Es el shell TS nuevo: no resuelve drifts de nombres ni stacks sin project ref. Usar el loop psql de la Parte 1 (estado final idéntico). |
| `postgres` no es superuser (no puede DDL ni tocar `schema_migrations`) | Usar `supabase_admin` (mismo password `POSTGRES_PASSWORD`). |
| Versiones remotas registradas sin sufijo (ej. `20260730180000` vs archivo `20260730180000_backend_gap_features.sql`) | Alinear con UPDATE antes de pushear, si no el CLI/loop no reconoce las aplicadas. |
| Roles JWT sin USAGE sobre `public` ("relation does not exist" / "permission denied for schema public") | `GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;` — ya incluido en `20260814160000_grants_schema_public.sql`. |
| `major_version` del `config.toml` distinto al remoto (ej. local 17, remoto PG 15) | En el repo del VPS: `sed -i 's/major_version = 17/major_version = 15/' supabase/config.toml` |
| Migración con sintaxis de PG más nueva que el remoto | El apply se corta ahí; corregir la migración |
| NO usar `scripts/apply-migrations.sh` contra Supabase real | Corre `supabase/ci/bootstrap.sql` (shim para CI que crea roles ya existentes → falla) y NO registra versiones |
| NO copiar/pegar SQL en el SQL editor de Studio | Aplica pero NO registra en `schema_migrations` → el próximo push intenta re-aplicar y falla con "already exists" |
| Clone sin `--branch` | Trae la rama default, que puede no tener las migraciones |
| Token de GitHub en la URL del clone | Rotar el PAT al terminar (GitHub → Settings → Developer settings) |
| Comandos por SSH desde PowerShell (Windows) | El pipe inyecta CRLF: usar `cat archivo | ssh root@vps "tr -d '\r' | bash -s"` o scp + `sed -i 's/\r$//'`. `docker exec -i` es obligatorio para stdin. |
| Multi-red en `docker inspect` | Usar la red del stack: `{{.NetworkSettings.Networks.<stackid>.IPAddress}}` |
| **NUNCA exponer el 5432** a internet | Todo corre dentro de la red interna del stack; no hace falta publicar el puerto |

## Parte 4 — Flujo rápido para repetir

```bash
# Local
git push origin <rama>

# VPS — update + push (loop psql) + verify
git -C /root/mediacion-repo pull origin <rama>
# loop de la Parte 1 paso 4
docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U supabase_admin -d postgres -Atc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations;"
```

Idempotente: solo aplica el delta entre el repo y las versiones registradas.

## Parte 5 — QA remoto (post-push)

```bash
# smoke_migrations.py (esperado 66/66) y validate_rls.py (esperado 17/17)
# — el 5432 no está publicado: correr en contenedor throwaway en la red del stack
printf 'DATABASE_URL=postgresql://supabase_admin:%s@supabase-db:5432/postgres?sslmode=disable\n' '<PW>' > /root/.env-verify
chmod 600 /root/.env-verify
docker run --rm --network <stackid> \
  -v /root/mediacion-repo/scripts:/scripts:ro \
  -v /root/mediacion-repo/requirements-dev.txt:/requirements.txt:ro \
  --env-file /root/.env-verify \
  python:3.12-slim sh -c "pip install -q -r /requirements.txt && python /scripts/smoke_migrations.py"
docker run --rm --network <stackid> \
  -v /root/mediacion-repo/scripts:/scripts:ro \
  -v /root/mediacion-repo/requirements-dev.txt:/requirements.txt:ro \
  --env-file /root/.env-verify \
  python:3.12-slim sh -c "pip install -q -r /requirements.txt && python /scripts/validate_rls.py"
rm -f /root/.env-verify
```

`validate_rls.py` necesita los fixtures: `test_01`/`test_02`/`test_03` (usuarios,
caso, items) y `test_10`/`test_11` (mediador/admin/no_parte, suscripción de
parte A). `tmp/` está gitignored → scp antes de la primera corrida.
