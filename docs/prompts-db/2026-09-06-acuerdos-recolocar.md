# Prompt — Acuerdos modulares: recolocar rondas/propuestas/acuerdos bajo negociación (Parte 4, breaking)

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación / Pactum". Pipeline: **DBML → migraciones (RLS+triggers) → scripts Python → QA/E2E → staging → producción**. Stack: PostgreSQL 17 local, 39 migraciones (tras Parte 3), 34 tablas, 23 enums, 16 funciones. Tipos (`packages/db-types`) a mano. Decisiones en `docs/decisiones-db/2026-09-06-acuerdos-modulares.md` (leelas; no re-decidas).

## Contexto

Parte 3 ya creó `negociaciones` (aditivo). Esta Parte 4 es el **paso que rompe**: mueve `rondas`, `propuestas`, `acuerdos` e `items` de colgar de `caso_id` a colgar de `negociacion_id`, cae los UNIQUE que impedían múltiples por caso, y retira `casos.ronda_actual` + `sync_ronda_actual`. Debe ser **una sola migración bien anunciada**.

## Inventario de lo que se rompe (verificado en el pedido FE §2)

- `acuerdos_caso_unique UNIQUE (caso_id)` (`20260723210000_acuerdos_caso_unique.sql:14`) → se cae.
- `rondas_caso_numero_unique UNIQUE (caso_id, numero)` (`20260721191655_constraints_indexes.sql:20`) → se cae, pasa a `(negociacion_id, numero)`.
- `propuestas_caso_ronda_unique UNIQUE (caso_id, ronda_id)` (`20260724011737_propuestas_ronda_unique.sql:14`) → se cae, pasa a `(negociacion_id, ronda_id)`.
- `casos.ronda_actual INT` + `sync_ronda_actual()` + `trigger_sync_ronda_actual` (`20260721191658_functions_triggers.sql:107`) → se retiran.

## Tareas

### 1. DBML (`mediacion.dbml`)

- `rondas`, `propuestas`, `acuerdos`, `items`: agregar `negociacion_id` como FK a `negociaciones`.
- Quitar las notas de UNIQUE por caso; documentar los nuevos UNIQUE por negociación.
- `casos`: quitar `ronda_actual` y la nota del trigger.

### 2. Migración (`supabase/migrations/20260906HHMMSS_acuerdos_recolocar.sql`)

Timestamp real, posterior a la de Parte 3. **Orden importante:**

1. **Backfill de negociaciones:** para cada `casos` existente sin `negociaciones`, insertar 1 fila `negociaciones (caso_id, materia='otro', method=<default>, estado='borrador', round=1)` y guardar el `id` mapeado caso→negociación (CTE/tabla temporal en la migración). `materia='otro'` = meaning "modelo viejo" (el front lo trata como "todavía no dividido por materia").
2. **`acuerdos`:** `ADD COLUMN negociacion_id UUID NOT NULL REFERENCES negociaciones(id);` backfill desde el caso vía la negociación mapeada; `ALTER TABLE acuerdos DROP CONSTRAINT acuerdos_caso_unique;`. Mantené `caso_id` (útil para RLS y queries caso-nivel). Rollback documentado.
3. **`rondas`:** `ADD COLUMN negociacion_id UUID NOT NULL REFERENCES negociaciones(id);` backfill; `DROP CONSTRAINT rondas_caso_numero_unique;` `ADD CONSTRAINT rondas_negociacion_numero_unique UNIQUE (negociacion_id, numero);`.
4. **`propuestas`:** `ADD COLUMN negociacion_id UUID NOT NULL REFERENCES negociaciones(id);` backfill desde `rondas.negociacion_id`; `DROP CONSTRAINT propuestas_caso_ronda_unique;` `ADD CONSTRAINT propuestas_negociacion_ronda_unique UNIQUE (negociacion_id, ronda_id);`.
5. **`items`:** backfill `negociacion_id` (los del caso → la negociación mapeada). Ya tiene la columna nullable de Parte 3.
6. **Retirar contador de caso:** `ALTER TABLE casos DROP COLUMN ronda_actual;` `DROP TRIGGER IF EXISTS trigger_sync_ronda_actual ON rondas;` `DROP FUNCTION IF EXISTS sync_ronda_actual();`. (La ronda ahora se lee de `negociaciones.round`.)
7. **RLS:** ajustar policies de `rondas`, `propuestas`, `acuerdos` para resolver el caso vía `negociacion_id → negociaciones.caso_id`, manteniendo `is_part_of_case`. `tareas`/`incumplimientos` referencian `acuerdo_id` (no cambian); `firmas` referencia `acuerdo_id` (no cambia).
8. **GRANTs:** sin cambios (mismos roles).

> Backfill: usá `UPDATE … FROM` con la tabla temporal caso→negociacion_id. Los `NOT NULL` recién se agregan tras el backfill. `DO $$`/CTE para idempotencia (re-ejecución segura de la migración).

### 3. Testing / QA

- `supabase db reset` → **40/40** migraciones.
- `supabase db lint` → 0.
- `scripts/smoke_migrations.py`: actualizar checks de UNIQUE — caen `acuerdos_caso_unique`, `rondas_caso_numero_unique`, `propuestas_caso_ronda_unique`; entran `rondas_negociacion_numero_unique`, `propuestas_negociacion_ronda_unique`. `EXPECTED_TABLES` sin cambio (34); `EXPECTED_ENUMS` sin cambio (23).
- `scripts/validate_rls.py`: verificar que RLS de `rondas`/`propuestas`/`acuerdos` resuelve por negociación→caso (parte ve lo suyo, no-miembro 0). Ajustar total. Grepeá `tmp/*.sql`: cualquier fixture que inserte `rondas`/`propuestas`/`acuerdos` con `caso_id` y no `negociacion_id` deben actualizarse para usar la negociación (o insertar la negociación primero).
- `npx tsc -b` → exit 0.

### 4. db-types (`packages/db-types/src/database.types.ts`)

- `rondas`, `propuestas`, `acuerdos`, `items`: agregar `negociacion_id`.
- `casos`: quitar `ronda_actual`.

### 5. Docs

- `docs/database.md`: notar la caída de los 3 UNIQUE, los nuevos por negociación, y la desaparición de `casos.ronda_actual` + `sync_ronda_actual`.
- `docs/changelogs-db/2026-09-06.md`: migración, decisiones, backfill (modelo viejo → `materia='otro'`), resultados QA, y el **flag a BE/FE**: `casos.ronda_actual` desaparece; la ronda se lee de `negociaciones.round` (`CaseSummary.roundNumber` por tarjeta).

## Reglas estrictas

1. **Una sola migración** para todo el paso breaking.
2. Backfill idempotente (re-ejecución segura de `db reset`).
3. Mantener `caso_id` en `acuerdos` (no lo quites) para no romper RLS/queries caso-nivel.
4. `search_path` no aplica (sin funciones nuevas), pero nombrá calificado.
5. No `git commit` ni `git push`.

## Criterio de aceptación

- `db reset` 40/40; `db lint` 0; `smoke_migrations.py` con los UNIQUE nuevos; `validate_rls.py` verde (RLS por negociación); `tsc -b` exit 0.
- Backfill verificado: tras `db reset`, cada caso tiene ≥1 `negociaciones` (materia `'otro'`) y sus `acuerdos`/`rondas`/`propuestas`/`items` apuntan a ella.
- Changelog actualizado con el flag BE/FE sobre `ronda_actual`.
- Sin commit.
