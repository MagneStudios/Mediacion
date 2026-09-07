# Prompt — `pendiente_suscripciones` escribible (C-01 follow-up)

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación / Pactum". Pipeline: **DBML → migraciones (RLS+triggers en el mismo paso) → scripts Python → QA/E2E → staging → producción**. Stack: PostgreSQL 17 local (`supabase/config.toml`, puertos 57001/57002/57003), 38 migraciones, 33 tablas, 21 enums, 16 funciones. Tipos (`packages/db-types`) se mantienen a mano.

## Estado inicial

- La migración `20260902120000_c01_gate_suscripciones.sql` ya agregó `ALTER TYPE estado_caso ADD VALUE 'pendiente_suscripciones'` y el gate `trg_casos_gate_suscripciones` (bloquea `activo`/`en_negociacion` si no ambas partes tienen `suscripciones.estado='activa'`).
- `validate_caso_estado_transition()` (`supabase/migrations/20260810120000_cambios_reunion_07_08.sql:139`) **no admite** `pendiente_suscripciones`: cualquier `UPDATE … SET estado='pendiente_suscripciones'` muere con `Transición de estado inválida: nuevo → pendiente_suscripciones`.
- `db-types` ya incluye el valor (lo agregó C-01). No hay tablas/nuevos enums.

## Objetivo

Hacer que `pendiente_suscripciones` sea un estado escribible, extendiendo solo la máquina de estados. El front ya lo consume; nadie lo alcanza hoy.

## Tareas

### 1. Migración (único archivo `supabase/migrations/20260906HHMMSS_pendiente_suscripciones_writable.sql`)

Usá timestamp real, posterior a `20260902120000`. **Solo `CREATE OR REPLACE FUNCTION`** de `validate_caso_estado_transition()` (la función ya existe con `SET search_path=''`). Agregar, respetando las transiciones actuales:

```sql
IF OLD.estado = 'nuevo' AND NEW.estado = 'pendiente_suscripciones' THEN
  RETURN NEW;
END IF;

IF OLD.estado = 'pendiente_suscripciones' AND NEW.estado IN
   ('activo', 'en_negociacion', 'terminado', 'vencido', 'expirado') THEN
  RETURN NEW;
END IF;
```

- **No tocar** `trg_casos_gate_suscripciones`: sigue lanzando `P0001` si no ambas partes al día; eso es correcto y consistente con que `pendiente_suscripciones → activo` pase solo cuando el gate lo permita.
- Rollback documentado: `CREATE OR REPLACE FUNCTION` a la versión anterior (sin los dos bloques nuevos).

### 2. Testing / QA

- `supabase db reset` → **39/39** migraciones.
- `supabase db lint` → 0.
- `scripts/smoke_migrations.py`: la función ya está en `EXPECTED_FUNCTIONS`; no cambia el conteo. Verificar que sigue verde (33 tablas, 21 enums, 16 funciones).
- `scripts/validate_rls.py` (ajustar total): agregar un check de que la transición `nuevo → pendiente_suscripciones` **es permitida** (no lanza excepción) y que `pendiente_suscripciones → activo` pasa cuando ambas partes tienen `suscripciones.estado='activa'` (reutilizá el helper `gate_user` del setup del gate C-01).
- `npx tsc -b` → exit 0.

### 3. Docs

- `docs/database.md`: en la sección de máquina de estados de `casos`, anotar `pendiente_suscripciones` y sus transiciones permitidas.
- `docs/changelogs-db/2026-09-06.md`: migración creada, decisión (`docs/decisiones-db/2026-09-06-pendiente-suscripciones-writable.md`), resultados de `db reset`/`lint`/`smoke`/`validate_rls`, y que el gate C-01 queda igual (BE escribe el estado en el catch del `P0001`).

## Reglas estrictas

1. **Solo `CREATE OR REPLACE FUNCTION`** sobre `validate_caso_estado_transition()`. Nada de DROP/ALTER TABLE/ADD COLUMN/ADD VALUE.
2. Conservar `SET search_path = ''` y la lógica existente de la función.
3. No modificar el gate ni `db-types` (el valor ya existe).
4. No `git commit` ni `git push`. Entregá el resumen; el commit lo hace el DB lead.

## Criterio de aceptación

- `db reset` 39/39; `db lint` 0; `smoke_migrations.py` verde; `validate_rls.py` incluye el nuevo check de transición permitida; `tsc -b` exit 0.
- Changelog `docs/changelogs-db/2026-09-06.md` creado.
- Sin commit.
