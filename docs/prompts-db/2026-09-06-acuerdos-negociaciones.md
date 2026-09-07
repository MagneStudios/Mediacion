# Prompt — Acuerdos modulares: tabla `negociaciones` + materia (Parte 3, aditivo)

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación / Pactum". Pipeline: **DBML → migraciones (RLS+triggers en el mismo paso) → scripts Python → QA/E2E → staging → producción**. Stack: PostgreSQL 17 local, 38 migraciones, 33 tablas, 21 enums, 16 funciones. Tipos (`packages/db-types`) a mano. Decisiones congeladas en `docs/decisiones-db/2026-09-06-acuerdos-modulares.md` (leelas; no re-decidas).

## Contexto

El cliente pasó de "1 caso = 1 acuerdo" a "1 caso = N negociaciones por materia (tenencia/alimentos/bienes), cada una con su propio acuerdo y firma". Esta Parte 3 es **100% aditiva**: crea la tabla `negociaciones` y el concepto de materia **sin romper** el path actual caso→acuerdos. Las Partes 4 y 5 (recolocar rondas/propuestas/acuerdos y versionado) vienen después.

## Decisiones aplicadas

1. Materia = nuevo enum `materia_acuerdo = (tenencia, alimentos, bienes, otro)`. No reusar `categoria_item`.
2. `items` gana `negociacion_id` (nullable + backfill en Parte 4).
3. Estado por negociación = nuevo enum `estado_negociacion` (ver abajo).
4. Ronda por negociación vive en `negociaciones.round` (reemplaza la semántica de `casos.ronda_actual` a nivel negociación; la columna de caso se retira en Parte 4).

## Tareas

### 1. DBML (`mediacion.dbml`)

- Enum `materia_acuerdo`, enum `estado_negociacion`.
- Tabla `negociaciones` completa con FKs, `UNIQUE (caso_id, materia)`, índices, y nota de RLS (resuelve caso vía `caso_id`).

### 2. Migración (`supabase/migrations/20260906HHMMSS_negociaciones.sql`)

Timestamp real, posterior a `20260902120000`. Aditiva:

- `CREATE TYPE materia_acuerdo AS ENUM ('tenencia','alimentos','bienes','otro');`
- `CREATE TYPE estado_negociacion AS ENUM ('borrador','activa','acordada','cerrada','terminada');` (estado por negociación; BE confirma nombres;
  si BE propone otros, anotalo en el changelog y usá los acordados).
- `CREATE TABLE negociaciones`:
  - `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
  - `caso_id UUID NOT NULL REFERENCES casos(id)`
  - `materia materia_acuerdo NOT NULL`
  - `method metodo_caso NOT NULL` (reusa el enum existente negociacion/conciliacion/mediacion)
  - `estado estado_negociacion NOT NULL DEFAULT 'borrador'`
  - `round INT NOT NULL DEFAULT 1`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `CONSTRAINT negociaciones_caso_materia_unique UNIQUE (caso_id, materia)`
  - `CREATE INDEX` en `(caso_id)`, `(materia)`.
  - `set_updated_at` trigger (patrón del repo).
- `ALTER TABLE items ADD COLUMN IF NOT EXISTS negociacion_id UUID REFERENCES negociaciones(id);` (nullable; backfill en Parte 4). Rollback: `DROP COLUMN`.
- **RLS:** `ALTER TABLE negociaciones ENABLE ROW LEVEL SECURITY;` + policy `SELECT/ALL` usando `is_part_of_case(caso_id)` (mismo patrón que `casos`/`items`). Reusá `is_part_of_case` existente.
- **GRANTs explícitos** (filosofía del repo, sin `ALTER DEFAULT PRIVILEGES`): `SELECT, INSERT, UPDATE, DELETE` a `authenticated`, `anon`, `service_role`, `postgres` — igual que el resto de tablas del repo.
- Rollbacks documentados por sección.

### 3. Testing / QA

- `supabase db reset` → **39/39** (esta Parte 3 es la migración 39).
- `supabase db lint` → 0.
- `scripts/smoke_migrations.py`: +1 tabla (`negociaciones`), +2 enums (`materia_acuerdo`, `estado_negociacion`) en `EXPECTED_TABLES`/`EXPECTED_ENUMS`. Ajustar total.
- `scripts/validate_rls.py`: sección "negociaciones RLS" — parte ve las de sus casos, no-miembro ve 0. Ajustar total.
- `npx tsc -b` → exit 0.

### 4. db-types (`packages/db-types/src/database.types.ts`)

- Tabla `negociaciones` con columnas (Kysely `ColumnType<...>`); enums `materia_acuerdo`, `estado_negociacion` como uniones; `Constants` actualizado.
- `items`: agregar `negociacion_id` (nullable).

### 5. Docs

- `docs/database.md`: árbol de migraciones (38 → 39), módulo "Negociaciones por materia", nuevos enums.
- `docs/changelogs-db/2026-09-06.md`: migración, decisiones aplicadas, resultados QA, y nota de que el path caso→acuerdos actual **no se toca** (aditivo puro).

## Reglas estrictas

1. **Aditivo puro.** Sin DROP/ALTER COLUMN TYPE/ALTER TABLE existente (salvo el `ADD COLUMN` nullable en `items`).
2. `search_path` no aplica a esta migración (no hay funciones nuevas), pero respetá el patrón de nombrar todo calificado.
3. GRANTs explícitos por objeto.
4. Nombre de archivo con `YYYYMMDDHHmmss` real, posterior a `20260902120000`.
5. **No `git commit` ni `git push`.** El DB lead commitea.

## Criterio de aceptación

- `db reset` 39/39; `db lint` 0; `smoke_migrations.py` (34 tablas, 23 enums) verde; `validate_rls.py` con RLS de negociaciones; `tsc -b` exit 0.
- Changelog `docs/changelogs-db/2026-09-06.md` creado.
- Sin commit.
