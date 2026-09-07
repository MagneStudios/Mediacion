# Prompt — Acuerdos modulares: versionado/renegociación (Parte 5, aditivo)

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación / Pactum". Pipeline: **DBML → migraciones (RLS+triggers) → scripts Python → QA/E2E → staging → producción**. Stack: PostgreSQL 17 local, 40 migraciones (tras Parte 4), 34 tablas, 23 enums, 16 funciones. Tipos (`packages/db-types`) a mano. Decisiones en `docs/decisiones-db/2026-09-06-acuerdos-modulares.md` (leelas; no re-decidas).

## Contexto

El cliente quiere que un acuerdo se renegocie: se abre una ronda nueva, se genera un acuerdo nuevo que **reemplaza** al anterior (el viejo queda en historial). Esta Parte 5 agrega el versionado a `acuerdos`. Es **aditiva** (no rompe lo de Parte 4).

## Decisión §5.2

Versionado = `vigente BOOLEAN` + `supersedes_agreement_id` + `version INT` + `valid_from TIMESTAMPTZ`. **No** se agrega miembro a `estado_acuerdo` (evita que el front renderice "reemplazado" como "borrador" en sus ternarios).

## Tareas

### 1. DBML (`mediacion.dbml`)

- `acuerdos`: agregar `version`, `supersedes_agreement_id`, `vigente`, `valid_from`. Nota: "acuerdo vigente por negociación = vigente=true".

### 2. Migración (`supabase/migrations/20260906HHMMSS_acuerdos_versionado.sql`)

Timestamp real, posterior a la de Parte 4. Aditiva:

- `ALTER TABLE acuerdos ADD COLUMN version INT NOT NULL DEFAULT 1;`
- `ALTER TABLE acuerdos ADD COLUMN supersedes_agreement_id UUID REFERENCES acuerdos(id);`
- `ALTER TABLE acuerdos ADD COLUMN vigente BOOLEAN NOT NULL DEFAULT true;`
- `ALTER TABLE acuerdos ADD COLUMN valid_from TIMESTAMPTZ NOT NULL DEFAULT now();`
- `CREATE INDEX idx_acuerdos_negociacion_vigente ON acuerdos (negociacion_id, vigente);` (para "acuerdo vigente de la negociación").
- Rollbacks documentados (`DROP COLUMN` ×4, `DROP INDEX`).

> Nota: `supersedes_agreement_id` referencia `acuerdos(id)` (auto-referencia). Sin CASCADE (si se borra el histórico, queda NULL — pero los acuerdos no se borran; son append-only de hecho).

### 3. Testing / QA

- `supabase db reset` → **41/41** migraciones.
- `supabase db lint` → 0.
- `scripts/smoke_migrations.py`: sin cambio de conteo de tablas/enums (34/23). Verificar que la tabla `acuerdos` tiene las 4 columnas nuevas (podés agregar un check explícito si querés).
- `scripts/validate_rls.py`: agregar un check de que un `INSERT` en `acuerdos` con `vigente=true` por defecto es válido y que RLS sigue resolviendo por caso vía `negociacion_id`. Ajustar total.
- `npx tsc -b` → exit 0.

### 4. db-types (`packages/db-types/src/database.types.ts`)

- `acuerdos`: agregar `version`, `supersedes_agreement_id`, `vigente`, `valid_from`.

### 5. Docs

- `docs/database.md`: sección de `acuerdos` con el modelo de versionado (vigente/supersedes/historial).
- `docs/changelogs-db/2026-09-06.md`: migración, decisión §5.2, resultados QA, y nota para BE/FE: "acuerdo vigente de la negociación" = `SELECT … WHERE negociacion_id=$1 AND vigente=true`; acción "Renegociar" precarga el actual y crea uno nuevo con `supersedes_agreement_id` apuntando al viejo y `vigente=false` en el viejo.

## Reglas estrictas

1. **Aditivo puro.** Sin DROP/ALTER COLUMN TYPE. Solo `ADD COLUMN` + índice.
2. No tocar `estado_acuerdo` (decisión §5.2 explícita).
3. No `git commit` ni `git push`.

## Criterio de aceptación

- `db reset` 41/41; `db lint` 0; `smoke_migrations.py` verde; `validate_rls.py` con el check de `vigente`; `tsc -b` exit 0.
- Changelog actualizado.
- Sin commit.
