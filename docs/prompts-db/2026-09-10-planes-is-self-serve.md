# Prompt — Agregar `is_self_serve` a `planes` (distinguir free/"a consultar")

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación" (plataforma de mediación y acuerdos extrajudiciales). Seguís el pipeline: **DBML → migraciones (RLS/triggers) → testing de migraciones → scripts Python → QA → staging → producción en Supabase**. Stack: PostgreSQL 17, Supabase local (`supabase/config.toml`), RLS activas, migraciones secuenciales en `supabase/migrations/`. Los tipos de BD (`packages/db-types`) se mantienen **a mano** — cada cambio de schema exige actualizarlos.

## Estado inicial

- ~46 migraciones (última: `20260909130000_casos_estado_insert_guard.sql`, la #44).
- `planes` columnas: `id, nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio NUMERIC(10,2) NOT NULL`. **No** tiene `is_self_serve`.
- `precio` por plan (seed): `base=0.00`, `simple=9.99`, `plus=19.99`, `particular=19.90`, `estudio=25.00`, `corporativo=0.00`.
- `corporativo` es "a consultar" (no self-serve); el resto es self-serve (incluye `base` gratis).
- `packages/db-types/src/database.types.ts` mantenido a mano.
- No hay RLS sobre `planes` que cambie.

## Contexto y decisiones

La decisión completa está en `docs/decisiones-db/2026-09-10-planes-self-serve.md`. Resumen ejecutable:

- Agregar `is_self_serve BOOLEAN NOT NULL DEFAULT true` a `planes`.
- `is_self_serve = false` **solo** para `corporativo`; el resto `true`.
- No backfill, no trigger en `auth.users`, no cambios a BE/FE. El alta free la resuelve el backend en el signup.

## Tareas (en orden de pipeline)

### 1. Migración (nuevo archivo `supabase/migrations/20260910120000_planes_is_self_serve.sql`)

```sql
ALTER TABLE planes ADD COLUMN is_self_serve BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN planes.is_self_serve IS
  'true = plan self-serve (el alta puede contratarlo; incluye base gratis y planes de pago). '
  'false = "a consultar" (corporativo): se contrata por ventas, no por el wizard del alta.';

UPDATE planes SET is_self_serve = false WHERE nombre = 'corporativo';
```

Aditiva. No tocar RLS, no crear suscripciones, no modificar `handle_new_user`.

### 2. db-types (hand-maintained)

En `packages/db-types/src/database.types.ts` agregar `is_self_serve: boolean` al tipo de la tabla `planes` (y al tipo Insert/Update si existe). Mantener la convención `ColumnType<...>` de Kysely ya usada en esa tabla. No regeneres todo el archivo.

### 3. Docs

- `docs/database.md`: en la sección `planes`, documentar `is_self_serve` y la distinción *free self-serve* (`base`) vs *"a consultar"* (`corporativo`); aclarar que `precio` sigue `NOT NULL` y que `base` es el free self-serve.

## Reglas estrictas

1. **Solo cambios aditivos.** Nada de DROP / RENAME / ALTER COLUMN TYPE.
2. **No tocar RLS** ni `handle_new_user`.
3. **No modificar `precio`** ni otras columnas de `planes`.
4. **No crear backfill** ni suscripciones ni aceptaciones de TyC.
5. El nombre de migración respeta el prefijo de timestamp y es posterior a `20260909130000`.
6. db-types: sumar la columna, no reescribir el archivo.

## Criterio de aceptación

- `npx supabase db lint` sin errores.
- `npx supabase db reset` aplica 45 migraciones.
- `python scripts/smoke_migrations.py` pasa.
- `packages/db-types` compila (`tsc -b` en raíz sin errores en `@mediacion/db-types`).
- `SELECT nombre, is_self_serve FROM planes ORDER BY nombre` → `corporativo=false`, el resto `true`.
- `python scripts/validate_rls.py` no degrada (los 10 fallos preexistentes no son de este cambio).
- No se modificó código de `apps/api` ni `mediacion-app`.
