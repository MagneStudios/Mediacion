# Ejecución local del proyecto Mediación

Guía paso a paso para levantar todo el stack de desarrollo en tu máquina.

---

## 1. Requisitos previos

| Herramienta | Versión mínima | Verificar |
|-------------|---------------|-----------|
| **Node.js** | >= 22 | `node -v` |
| **pnpm** | 11.15.1 (fijado en package.json) | `pnpm -v` |
| **Docker Desktop** | reciente | `docker --version` |
| **Supabase CLI** | 2.x | `supabase --version` |
| **Python** | 3.10+ | `python --version` |
| **Git** | 2.x | `git --version` |

> Los scripts Python usan `psycopg2-binary` y `faker`. Se instalan con pip (paso 4).

---

## 2. Clonar e instalar dependencias

```bash
git clone https://github.com/MagneStudios/Mediacion.git
cd Mediacion

# Instalar dependencias del monorepo
pnpm install
```

El monorepo tiene 4 workspaces:
- `apps/api` — Backend NestJS
- `apps/panel` — Panel web (placeholder sin lógica aún)
- `packages/shared` — DTOs e interfaces compartidas
- `packages/db-types` — Tipos generados de Supabase (consumidos por Kysely)

---

## 3. Variables de entorno

```bash
cp .env.example .env
```

Abrí `.env` y completá las claves mínimas para desarrollo local. Las que necesitás **obligatoriamente**:

```env
SUPABASE_URL=http://localhost:57001
SUPABASE_ANON_KEY=       # (obtener con: supabase status)
SUPABASE_SERVICE_ROLE_KEY= # (obtener con: supabase status)
DATABASE_URL=postgresql://postgres:postgres@localhost:57002/postgres
JWT_SECRET=              # (obtener con: supabase status)
OPENROUTER_API_KEY=      # (para el motor de IA; sin esto no funciona)
```

Las claves de Supabase (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`) se obtienen con `supabase status` después de levantar la base (paso 5).

Las demás variables (DocuSign, Mercado Pago, SMTP, etc.) son opcionales para desarrollo local — el API levanta sin ellas pero esas funcionalidades no van a funcionar.

---

## 4. Dependencias Python (scripts de testing/seed)

Los scripts de testing y seed están en `scripts/` y usan Python:

```bash
pip install -r requirements-dev.txt
```

Esto instala:
- `psycopg2-binary` — conexión a Postgres
- `faker` — generación de datos de prueba

---

## 5. Base de datos local (Supabase)

Levantá todos los servicios de Supabase con Docker:

```bash
supabase start
```

Esto levanta:
| Servicio | Puerto |
|----------|--------|
| **API (PostgREST)** | `localhost:57001` |
| **Base de datos (Postgres)** | `localhost:57002` |
| **Supabase Studio** (dashboard UI) | `localhost:57003` |
| **SMTP test (Mailpit)** | `localhost:57004` |

Abrí Supabase Studio en `http://localhost:57003` para ver y manipular datos desde la UI.

### Cargar las migraciones y datos de prueba

Para resetear la base a estado limpio (aplica las 33 migraciones + seed):

```bash
supabase db reset
```

Después de esto, obtené las claves de Supabase:

```bash
supabase status
```

Copiá el `anon key`, `service_role key` y `JWT secret` a tu `.env`.

### Fixtures de testing (opcional)

Si necesás datos de prueba para los tests de integración (usuarios, casos, items, módulo TyC):

```powershell
.\scripts\setup_test_env.ps1
```

> Solo funciona en PowerShell (Windows). Corre los SQL de `tmp/test_*.sql` y luego `validate_rls.py`.

### Scripts de verificación de DB

```bash
# Smoke test: verifica que todas las tablas, enums e integridad existan
python scripts/smoke_migrations.py

# Valida RLS con diferentes roles JWT
python scripts/validate_rls.py

# Lint del esquema (via Supabase CLI)
supabase db lint
```

---

## 6. Compilar el monorepo

Antes de levantar el API, compilá los paquetes compartidos:

```bash
# Compilar packages/shared (DTOs)
pnpm --filter @mediacion/shared build

# Typecheck completo del grafo de referencias
pnpm typecheck
```

> `packages/db-types` no tiene build propio — exporta `.ts` directamente.

---

## 7. Levantar el Backend (API NestJS)

```bash
pnpm --filter @mediacion/api start:dev
```

El API levanta en `http://localhost:3000` por defecto. Carga las variables de entorno desde `/.env` vía `--env-file`.

Si querés ver las migraciones aplicadas en el output de consola, usá `supabase status` para confirmar conexión.

### Test del API

```bash
pnpm --filter @mediacion/api test
```

---

## 8. Lint y typecheck

```bash
# Lint completo (Biome, incluye formatter + linter)
pnpm lint

# Typecheck (TypeScript, grafo de referencias de proyecto)
pnpm typecheck

# Test de todos los workspaces Node
pnpm -r test
```

---

## 9. Móvil (Expo / React Native)

La app móvil está en `mediacion-app/`. Para levantar en dev:

```bash
cd mediacion-app
pnpm install        # (ya se hizo en el pnpm install global)
npx expo start
```

Opciones:
- `npx expo start --android` — abre en emulador Android o dispositivo
- `npx expo start --ios` — abre en emulador iOS o dispositivo
- `npx expo start --web` — abre en navegador (Expo Web)

La app usa Expo SDK 54 y conecta al API local. Configurá la URL del API en el `.env` de la app móvil si es necesario.

> La app móvil **no** es necesaria para desarrollo de backend/base de datos.

---

## 10. Edge Functions (Deno)

Las Edge Functions están en `supabase/functions/`. Actualmente solo hay una (`health`):

```bash
# Test de una función Edge
deno test --config supabase/functions/health/deno.json supabase/functions/health
```

Las Edge Functions se ejecutan dentro de `supabase start` automáticamente.

---

## Puertos del stack local

| Servicio | Puerto |
|----------|--------|
| Supabase API (PostgREST) | 57001 |
| Postgres (base de datos) | 57002 |
| Supabase Studio | 57003 |
| SMTP test (Mailpit) | 57004 |
| API NestJS | 3000 |
| Shadow DB (migraciones) | 57000 |
| Pooler (deshabilitado) | 57009 |

---

## Flujo típico de desarrollo

```bash
# 1. Levantar todo
supabase start
supabase db reset              # resetea DB a estado limpio

# 2. Obtener claves y configurar
supabase status                # copiar keys a .env

# 3. Compilar y levantar API
pnpm install
pnpm --filter @mediacion/shared build
pnpm --filter @mediacion/api start:dev

# 4. Trabajar (editar, commit, push)
# 5. Verificar
pnpm lint
pnpm typecheck
pnpm -r test
supabase db lint
```

---

## Troubleshooting

### `supabase start` no levanta
- Asegurate de que Docker esté corriendo y tenga al menos 4 GB de RAM asignada.
- Verificá que los puertos 57000-57009 no estén ocupados por otra cosa.

### `supabase db reset` falla en migraciones
- Verificá que las migraciones en `supabase/migrations/` estén en orden cronológico.
- Si hay errores de duplicados, puede ser que una migración anterior dejó la DB en estado inconsistente — revisá el output del `db reset`.

### `pnpm install` falla con errores de engine
- Asegurate de que Node.js >= 22 esté instalado: `node -v`.
- `engine-strict=true` está configurado en `.npmrc`, así que la versión se valida.

### API no conecta a la base
- Verificá que `DATABASE_URL` en `.env` apunte a `localhost:57002` y que `supabase start` esté corriendo.

### Tests Python fallan con `psycopg2`
- Reinstalá: `pip install --force-reinstall psycopg2-binary`

---

## Notas de versiones

- **TypeScript 6 vs 7**: `apps/api` usa `typescript@^6.0.3` (NestJS CLI 11 no soporta TS 7); el resto del workspace usa `typescript@^7.0.2`.
- **Kysely 0.28**: fijado porque kysely 0.29 es ESM-only y rompe Jest (@swc/jest, CommonJS).
- **`@Inject(ClassName)` explícito**: necesario en NestJS para que Biome no borre los imports de DI.
