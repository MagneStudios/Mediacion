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
3. **`pago_a_cargo`:** ✅ **Resuelto 10-09** — entra opcional por el body de `POST /casos/:id/invitaciones`, se persiste y sale tanto en la respuesta del alta como en `GET /casos/:id/invitaciones`. Un valor fuera del `CHECK` es `400 invalid_input` (no el `409 conflict` genérico de la constraint); `null` sigue siendo válido porque `NULL IN (...)` no es `FALSE`. `valoresPagoACargo` en `invitaciones.types.ts` es la copia a mano del CHECK: la columna es `TEXT`, no un enum, así que el dominio no se puede derivar del esquema.
4. **`negociaciones.estado`:** ✅ **Resuelto 10-09** — pasa de `borrador` a `activa` al generarse la primera propuesta de esa materia, el mismo momento en que el caso pasa a `en_negociacion`. El UPDATE está guardado en `borrador`: es idempotente y una materia `acordada` no vuelve atrás por ahí (para eso está `renegociar`). `cerrada`/`terminada` siguen sin escribirse: terminar un caso no termina sus materias hoy, y decidir si debería es producto.
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

---

## Respuesta de Backend — 2026-09-10

Los seis pedidos quedan cerrados: 1 y 5 con acuerdos modulares, 6 con `acordado` derivado, 2 el 09-09, y 3 y 4 hoy (arriba). Detalle en `docs/changelogs/2026-09-10-pendientes-post-auditoria.md`.

**Y una cosa que encontramos al intentar comprobarlos, que conviene que sepan:** las **ocho suites de integration estaban rojas** desde la migración 44 — 42 tests, todos con el mismo error, `Estado inicial inválido en INSERT`. Las fixtures insertaban `casos` directo en `en_negociacion`/`acordado`/`cerrado` y esa migración hizo correr la máquina de estados también en INSERT. Ya está arreglado con un helper único (`apps/api/src/casos/caso-estado.fixture.ts`) que camina la máquina, y **la corrida completa contra Postgres real quedó en 176 suites / 1486 tests, cero skipped** — la primera entera en verde desde el 09-09.

Dos notas para DB de eso:

1. **`trg_casos_gate_suscripciones` también aplica a los saltos de una fixture**, y a `reopenFromAcordado`. Cualquier transición a `activo`/`en_negociacion` con partes sin suscripción activa levanta `caso_bloqueado_suscripciones` — incluida la que hace `POST /negociaciones/:id/renegociar`, que rollbackea la renegociación entera. Puede ser exactamente lo que el gate quiere; lo decimos porque no está escrito en ningún lado.
2. **Sin `DATABASE_URL` jest saltea todas las suites de integration y reporta verde.** Ocho suites estuvieron rotas un día entero sin que nada avisara, y en el camino se colaron tres llamadas con una firma vieja que tampoco avisó. Si CI corre sin base, ese verde no significa nada.

---

## Respuesta de Frontend — 2026-09-10

§3 y §4 consumidos el mismo día — `docs/changelogs/2026-09-10-post-desbloqueos-backend.md`. `pago_a_cargo` real reemplazó el merge de sesión que veníamos arrastrando desde el 25/08; `negociaciones.estado` ya no se deriva de `casos.estado` de nuestro lado tampoco — se deriva de la ronda/propuesta propia de cada negociación, que es lo que hacía falta para que una segunda materia tenga estado propio.
