# Pedidos DB → Backend / Frontend — Post-auditoría (09-09)

**Fecha:** 09/09/2026
**Fuente:** auditoría FE (`docs/auditoria-desbloqueos-09-09-2026.md`) + autouditoría DB.
**Autouditoría:** `db reset` 44/44 · `db lint` 0 · `smoke_migrations.py` 92/92 · `packages/db-types` typecheck exit 0 · `validate_rls.py` 51/61 (10 fallos en otros módulos, **sin regresión** de este cambio; ver abajo).

## Estado entregado (schema)

- Acuerdos modulares (P1/P3/P4/P5): migraciones 39–42 (`feat/supabase-db`, commit `e34a8c4`).
- **Migración 44** `20260909130000_casos_estado_insert_guard`: la máquina de estados de `casos` corre también en `INSERT` (cierra el hallazgo técnico A de la auditoría FE). El estado inicial solo puede ser `nuevo`/`pendiente_suscripciones`.
- Doc DB corregida en los 4 errores que FE marcó: enums inventados, backfill documentado como `'otro'` (real = `NULL`), `invitacion_ttl_horas` "se lee desde el backend" (falso), `pago_a_cargo` "se devuelve en `/invitaciones`" (falso), y `validate_caso_estado_transition` "ya SECURITY DEFINER" (falso).
- **`acordado` derivado: DELEGADO a Backend** (DB no implementa trigger). Decidido en `docs/decisiones-db/2026-09-06-acuerdos-modulares.md` §3.

## Pedido a Backend

1. **Flag `tsc -b` en `apps/api` (P4):** portar `acuerdos`/`rondas`/`propuestas`/`mediaciones` a `negociacion_id`; reemplazar toda lectura de `casos.ronda_actual` por `negociaciones.round`. Detalle y líneas en `docs/pedidos-db-a-backend-acuerdos-modulares.md` §3.
2. **`invitacion_ttl_horas`:** ✅ **Resuelto 09-09** — el backend ahora lee `configuracion.invitacion_ttl_horas` (fallback 72 h) en `invitations.repository.ts` / `invitation-ttl.ts`. Documentado en `docs/integration-contract.md` y `docs/frontend-redesign/state-machines.md`.
3. **`pago_a_cargo`:** son dos cambios, no uno — la columna existe en `invociaciones` pero **nunca se persiste ni se expone** en `GET /casos/:id/invitaciones`.
4. **`negociaciones.estado`:** escribirlo tras la creación (el motor sigue leyendo por caso).
5. **Versionado P5:** consumir `vigente`/`supersedes_agreement_id` en el flujo Renegociar.
6. **`acordado` derivado:** calcularlo en BE (`CasosRepository.markAcordado`) cuando todas las materias del caso tienen acuerdo vigente+firmado.

## Pedido a Frontend

1. **`materia` en `negociaciones`:** `NULL` = modelo viejo → render "Sin materia / modelo anterior"; `'otro'` = materia explícita no clasificada (no usar como relleno).
2. **`roundNumber`** por tarjeta de caso ya viene por negociación (`negociaciones.round`).
3. **`vigente` / `supersedes_agreement_id`** para historial de versiones; no usar `estado_acuerdo` para "reemplazado".
4. **`acordado` derivado** lo calcula BE; FE ya lo consume.
5. **Backfill legacy:** los casos del modelo viejo tienen `materia = NULL` (nunca `'otro'`).

## Nota — `validate_rls.py` 51/61 (fuera de alcance de este cambio)

Los 10 fallos son preexistentes y en módulos ajenos a acuerdos modulares / mig 44:

- `solicitudes_arrepentimiento`, `avisos_version_legal`, `solicitudes_contacto`, `rate_limit_counters`, `payment_events`: `SELECT` anon/authenticated permitido cuando se esperaba denegado (tablas server-only de TyC/contacto/monetización).
- `usage_counters`: el dueño ve 1 en vez de 2 períodos.
- `acuerdos_select`: devuelve 2 en vez de 1 (P4 — la política resuelve el caso por `negociacion_id`; conviene revisar si el caso de prueba debe tener 1 o 2 acuerdos).

Ninguno es regresión de las correcciones de esta sesión (migration 44 solo afecta `casos.estado`; los edits de doc no tocan RLS). Se recomienda un seguimiento aparte.
