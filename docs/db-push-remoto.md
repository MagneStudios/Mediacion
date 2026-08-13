# Push de migraciones al Supabase self-hosted (Coolify)

Cómo aplicar las migraciones de `supabase/migrations/*.sql` al Supabase self-hosted
que corre en el VPS (`169.58.88.64`) vía Coolify.

## Contexto

- Postgres corre **solo dentro de la red Docker de Coolify**: el puerto 5432 NO se
  publica a internet (postura de seguridad, ver `docs/deploy-coolify.md`).
- La DB se alcanza por el **hostname interno** (`supabase-db`, alias de red del stack),
  no por la IP pública.
- Para migrar se usa la **CLI oficial de Supabase como contenedor Docker** en el VPS,
  atado a la red interna del stack. Nada de exponer 5432 ni tuneles.
- `supabase db push` aplica las migraciones **y registra las versiones** en
  `supabase_migrations.schema_migrations`. Eso es lo que hace que los próximos
  `db push` apliquen solo el delta.

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
    docker exec -e PGPASSWORD='<PW>' $c psql -U postgres -d postgres -Atc \
      "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
  done
  ```
  La que tenga el schema del proyecto (o los datos) es la correcta.

Datos necesarios de la instancia:

- **Stack ID / red** (ej. `qh5a6xd5ju7302obz5ozb74n`)
- **Contenedor** `supabase-db-<stackid>`
- **Password**: `SERVICE_PASSWORD_POSTGRES` (o `POSTGRES_PASSWORD`) del stack,
  visible en las env vars del servicio en Coolify
- **Usuario**: `postgres` (superuser). `supabase_storage_admin` NO sirve (no puede DDL).

> **Regla**: no tocar instancias de otros proyectos. Verificá siempre cuál es la tuya
> antes de migrar.

## Parte 1 — Migraciones nuevas en proyecto existente

1. **Local**: pushear la rama que tiene las migraciones nuevas
   ```bash
   git push origin <rama>
   ```

2. **VPS**: obtener/actualizar el repo
   - Primera vez (repo privado, necesita PAT de GitHub):
     ```bash
     cd /root
     git clone --branch <rama> https://<PAT>@github.com/<org>/<repo> <repo>
     ```
     El `--branch <rama>` es obligatorio: sin él se clona la rama default.
   - Ya clonado:
     ```bash
     git -C /root/<repo> pull origin <rama>
     ```

3. **Pre-flight**: ver qué versiones están registradas en el remoto
   ```bash
   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
     "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
   ```
   - Si da `relation ... does not exist`: es la primera migración (ver Parte 2 paso 4).
   - Si lista versiones: el push aplicará solo las que faltan.

4. **Push**
   ```bash
   docker run --rm \
     --network <stackid> \
     -v /root/<repo>:/repo \
     -w /repo \
     supabase/cli db push \
     --db-url "postgresql://postgres:<PW>@supabase-db:5432/postgres?sslmode=disable"
   ```
   `db push` crea `supabase_migrations.schema_migrations` si no existe, aplica las
   migraciones pendientes en orden y registra sus versiones.

5. **Verificar**
   ```bash
   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
     "SELECT count(*) FROM supabase_migrations.schema_migrations;"

   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
     "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
   ```
   El count de versiones debe coincidir con `ls supabase/migrations/*.sql | wc -l`.

## Parte 2 — Proyecto nuevo (primera vez)

1. Crear el stack Supabase en Coolify (one-click) y anotar stackid/red/password
   (Parte 0).
2. Clonar el repo en el VPS (Parte 1, paso 2).
3. **Pre-flight**: el schema `public` debe estar vacío
   ```bash
   docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
     "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
   ```
   - Si da `0`, listo.
   - Si da > 0: el stack tiene otro schema (¿otro proyecto?) → NO tocar. Si se confirma
     que es el del proyecto y no hay datos que perder:
     ```sql
     DROP SCHEMA public CASCADE;
     CREATE SCHEMA public;
     ```
4. **Push** con la plantilla de la Parte 1 → aplica todas las migraciones en orden y
   crea el tracking.
5. **Verificar** con las mismas queries de la Parte 1.

## Parte 3 — Gotchas (errores encontrados en la práctica)

| Problema | Solución |
|---|---|
| `major_version` del `config.toml` distinto al remoto (ej. local 17, remoto PG 15) | Para `db push` no bloquea. Si el CLI se queja, `sed -i 's/major_version = 17/major_version = 15/' supabase/config.toml` en el repo del VPS |
| Migración con sintaxis de PG más nueva que el remoto | El push se corta ahí; corregir la migración |
| NO usar `scripts/apply-migrations.sh` contra Supabase real | Corre `supabase/ci/bootstrap.sql` (shim para CI que crea roles ya existentes → falla) y NO registra versiones |
| NO copiar/pegar SQL en el SQL editor de Studio | Aplica pero NO registra en `schema_migrations` → el próximo `db push` intenta re-aplicar y falla con "already exists" |
| Clone sin `--branch` | Trae la rama default, que puede no tener las migraciones |
| Token de GitHub en la URL del clone | Revocar al terminar (GitHub → Settings → Tokens) |
| **NUNCA exponer el 5432** a internet | El contenedor CLI corre dentro de la red interna del stack; no hace falta publicar el puerto |

## Parte 4 — Flujo rápido para repetir

```bash
# Local
git push origin <rama>

# VPS — update + push + verify
git -C /root/<repo> pull origin <rama>
docker run --rm --network <stackid> -v /root/<repo>:/repo -w /repo \
  supabase/cli db push \
  --db-url "postgresql://postgres:<PW>@supabase-db:5432/postgres?sslmode=disable"
docker exec -e PGPASSWORD='<PW>' supabase-db-<stackid> psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations;"
```

Idempotente: solo aplica el delta entre el repo y las versiones registradas.
