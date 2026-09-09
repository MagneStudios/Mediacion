# Changelog — Proyecto Mediación

## 2026-09-03 — Monetización fase 2 (BE): `GET /suscripciones/uso`, `402 quota_exceeded` y columnas de cuota en `GET /planes`

**Origen:** §3.1, §3.2 y §3.3 de `docs/pedidos-frontend-monetizacion.md`, con los shapes que Front congeló. Spec: `_bmad-output/implementation-artifacts/spec-monetizacion-uso-y-cuota.md`. Fichas nuevas: §11 y §12 de `docs/fichas-legal-backend.md`.

---

### Qué faltaba

DB entregó la Fase 1 el 21/08 (`usage_counters`, `consume_quota`, `max_*_per_period` en `planes`, `current_period_*` en `suscripciones`) y nada en `apps/api/src` la usaba: `planColumns` no exponía las dos columnas de cuota, no existía lectura del uso, nadie llamaba a `consume_quota` al crear un caso, y `current_period_start/end` nunca se escribían — con lo cual `consume_quota` habría fallado siempre con `NO_BILLING_PERIOD`.

### Qué entra

- **`GET /planes`** trae `max_negotiations_per_period` y `max_clients_per_period` (`number | null`, NULL = ilimitado). Dos líneas en el allowlist; el compile-guard de `pagos.types.spec.ts` ahora las exige.
- **`GET /suscripciones/uso`** (`SuscripcionesService.getUso`, ficha §11): `{ period_start, period_end, negociaciones: { usado, limite }, clientes: { usado, limite } | null }`. Misma titularidad que `/vigente`; "con plan" = `estado IN ('activa','vencida')`, el conjunto que acepta `consume_quota`; el período sale de la suscripción del pagador y el contador de `usage_counters` por el `usuario_id` del caller. Sin fila de contador ⇒ `usado: 0`. `clientes` sólo para el titular de un estudio.
- **`POST /casos` consume cuota** (ficha §12): `UsageRepository.consumeNegotiation(trx, callerId)` llama a `public.consume_quota(caller, 'negotiation')` como hook `beforeInsert` de `CasosRepository.createCaseWithParteA`, dentro de la transacción que inserta `casos` + `caso_partes`. `P0002` → `QuotaExceededError` (402) en `toDomainError`; `CasosService` lo completa con `recurso/usado/limite/period_end` leyendo el uso actual y lo relanza. El `403 plan_limit_exceeded` (stock sobre `limite_casos`) sigue corriendo antes y ahora lleva `recurso: "casos"`, `usado`, `limite`.
- **Envelope extendido**: `AllExceptionsFilter` pasa los campos adicionales del body de una `HttpException` dentro de `error`. `code`/`message` siguen obligatorios; `statusCode` (y el `error` de las built-in de Nest, que de otro modo se colaba como `"Unauthorized"`) nunca viajan. Verificado con specs que fijan 401 (built-in y con `code`), 404, 409 idénticos a antes.
- **Período real**: `applyPayment` escribe `current_period_start = now` y `current_period_end = now + 30 días` (`billingPeriodDays`, `pagos/billing-period.ts`) en el mismo `UPDATE` que pone `activa`. Las filas activas/vencidas sin período (todas las anteriores a hoy) reciben la ventana de 30 días anclada en `fecha_inicio` que contiene `now` la primera vez que se las lee o consume (`setPeriodIfMissing`: `UPDATE ... WHERE ambas IS NULL`, con fallback a leer lo que persistió un escritor concurrente). Nunca se avanza un período ya escrito, nunca se marca `past_due`.

### Decisiones que el spec dejaba libres

- `QuotaExceededError` lleva `message: "Quota exceeded for this period"` — genérico y no "Negotiation ...", porque el tipo no sabe el `p_kind` (el `P0002` de Postgres sólo dice `QUOTA_EXCEEDED`) y `recurso` ya nombra el recurso.
- El 403 no lleva `period_end`: un límite de stock no tiene período.
- `fecha_inicio` NULL además de período NULL (sólo alcanzable a mano o por fixture): el ancla es `now`.
- Cuando la lectura del uso responde 404 para quien acaba de recibir el `P0002` (miembro de estudio no titular), el 402 sale sin detalle, como FE aceptó; cualquier otro fallo de esa lectura se propaga, no se esconde detrás del 402.
- `ensureBillingPeriod` corre antes de consumir y es no-op si el caller no tiene plan según `/uso`: la decisión final la sigue tomando `consume_quota` (P0001 → 409 genérico, como hoy).
- `findForUsoByOwner` ordena personal → `activa` → más reciente; `consume_quota` sólo ordena personal → primera. Difieren únicamente si un mismo owner tiene una `activa` y una `vencida` a la vez.

### Deuda conocida (para DB/Producto)

`consume_quota` resuelve la suscripción del estudio para **cualquier** miembro (`usuarios.estudio_id`), mientras `/uso` sólo para el titular (`rol = 'estudio'` y `activo`). Un miembro no titular consume contra el plan del estudio, pero no puede leer su uso, recibe el 402 sin detalle, y si la fila del estudio no tiene período todavía, `consume_quota` le responde `NO_BILLING_PERIOD` (409) porque la API sólo completa el período de las suscripciones que `/uso` resuelve. O `consume_quota` adopta el criterio de titularidad, o `/uso` se abre a los miembros.

### Qué **no** entra

Preapproval/`back_url` (§3.4), endpoints de abogado (§3.5), `plans.active`/`is_self_serve` (§5), job de contingencia/`past_due`, consumo de `clients` (el alta de clientes de estudio no existe todavía en la API). Ninguna migración SQL: `usage_counters.created_at` sigue declarada en db-types y ausente en la tabla — no se selecciona.

### QA

- `pnpm typecheck` limpio; `pnpm biome ci .` sin hallazgos.
- `pnpm --filter @mediacion/api test` contra Postgres real (38 migraciones): **159/159 suites, 1261/1261 tests** (baseline 156 / 1198). Suites nuevas: `billing-period.spec.ts`, `usage.repository.spec.ts`, `uso-y-cuota.integration.spec.ts` (DB-gated: 3 casos OK, 4.º → 402 con `usado: 3`/`limite: 3`/`period_end` y contador en 3, rollback del consumo cuando el insert falla, período anclado persistido al leer, período de 30 días exactos desde `applyPayment`).
