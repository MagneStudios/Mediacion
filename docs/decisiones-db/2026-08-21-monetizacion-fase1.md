# Decisiones — Monetización Pactum Fase 1 (2026-08-21)

**Fecha:** 21/08/2026
**Contexto:** `docs/PACTUM-monetizacion-spec.md` v1.0 define un modelo de planes/accounts/suscripciones nuevo. Esta decisión fija cómo se adapta al schema existente de forma aditiva, y registra los defaults reversibles (#3 y #4) y la resolución de la deuda `has_accepted_current` (O1).

## 1. Resolución deuda técnica: has_accepted_current EXECUTE (O1)

**Problema:** `20260817140000_has_accepted_current_vigencia.sql` agregó `authenticated` al GRANT EXECUTE de `has_accepted_current(uuid, text)`, contradiciendo la decisión 2 del diseño original (helper de servidor, EXECUTE solo service_role/postgres). El cambio fue un fix de testing, no una decisión de diseño.

**Decisión:** **Revertir.** La función es helper SECURITY DEFINER que el BE consume vía `selectNoFrom`; no hay caso de uso legítimo para que `authenticated` la invoque como RPC (permitiría sondear si un `user_id` arbitrario aceptó los términos).

**Implementación:** `supabase/migrations/20260821000000_revert_has_accepted_current_grant.sql` → `REVOKE EXECUTE ... FROM authenticated`.

**QA:** `validate_rls.py` restaura el test "has_accepted_current denegado para authenticated" (45/45 PASS).

**Estado final:** EXECUTE solo `service_role` y `postgres`. Deuda cerrada en `agents/db/deuda-has-accepted-current-execution.md`.

## 2. Adaptación del spec al schema existente (O2)

**Problema:** el spec define `plans` (code PK), `accounts` y `subscriptions` como tablas nuevas; el repo ya tiene `planes` (UUID PK), `usuarios`/`estudios` (con `usuarios.estudio_id` = managed-by) y `suscripciones` (XOR usuario_id/estudio_id) con FKs, RLS, triggers y contratos vivos.

**Decisión:** **extender las tablas existentes, no crear el modelo paralelo del spec.** Contrato completo en `docs/contrato-spec-repo-monetizacion.md`.

| Spec | Repo | Acción |
|---|---|---|
| `plans` | `planes` | ADD COLUMN `max_negotiations_per_period`, `max_clients_per_period` (NULL = ilimitado) |
| `subscriptions` | `suscripciones` | ADD COLUMN `current_period_start/end`, `cancel_at_period_end`, `mp_preapproval_id` (UNIQUE), `mp_payer_email`; ADD VALUE `pausada` |
| `accounts` | `usuarios`/`estudios` | No se crea; `usuarios.estudio_id` ya modela la cartera |
| `usage_counters` | `usage_counters` | Nueva, PK `(usuario_id, period_start)` |
| `lawyer_requests` | `lawyer_requests` | Nueva, FK `caso_id → casos` (negotiations → casos) |
| `payment_events` | `payment_events` | Nueva, UNIQUE `(provider, event_type, resource_id)` |

## 3. Default #3 (reversible): cliente hereda cuota de 3 negociaciones/mes

**Problema:** ¿cada cliente de la cartera de un estudio hereda la cuota de 3 negociaciones/mes del plan Particular, o el estudio tiene negociaciones ilimitadas dentro de su cartera? (spec §3.2, decisión pendiente #3)

**Decisión (propuesta por defecto del spec, implementada):** cada cliente de la cartera hereda la cuota del **plan del estudio** (plan estudio = `max_negotiations_per_period = 3`). `consume_quota` resuelve la suscripción efectiva vía `coalesce` de `usuarios.estudio_id` y lleva el contador por cliente real.

**Cómo revertir:** cambiar el plan estudio a `max_negotiations_per_period = NULL` (pool compartido) — el resto del código no cambia; el contador se llevaría por `v_billing_account_id` en vez de `p_account_id` (spec §5.1.1 lo documenta: "basta con cambiar el account_id del usage_counters").

## 4. Default #4 (reversible): 20 altas es flujo mensual, no stock

**Problema:** "crear hasta 20 clientes por mes" — ¿flujo mensual o tope de cartera total? (spec §3.2, decisión pendiente #4)

**Decisión (propuesta por defecto del spec, implementada):** **flujo mensual** — `max_clients_per_period = 20`, el contador se resetea creando una fila nueva por período; la cartera acumulada no tiene tope.

**Cómo revertir:** agregar `max_clients_total` (nullable) a `planes` y chequearlo en `consume_quota` — el spec §4 ya lo contempla como reservado.

## 5. Seeds de planes (ON CONFLICT)

**Decisión:** `particular` (3 negociaciones/mes, precio 19.90) y `corporativo` (límites NULL = ilimitado, precio 0.00 = "a consultar", spec §3.3) se insertan con `ON CONFLICT (nombre) DO UPDATE` sobre las columnas nuevas; `estudio` se actualiza con `max_negotiations_per_period = 3, max_clients_per_period = 20`. Los planes legacy (base/simple/plus) se conservan intactos (aditivo puro).

## 6. Reglas aplicadas (spec §13 de reglas estrictas)

- Aditivo puro: ningún DROP de objetos existentes; solo ADD COLUMN / ADD VALUE / CREATE.
- `search_path=''` en `consume_quota` (SECURITY DEFINER).
- Montos en integer minor units (`monto_minor` en `lawyer_requests`); nunca float.
- Escritura de facturación jamás desde el cliente: RLS lectura owner, escritura solo `service_role`/`postgres`.
- GRANTs explícitos, sin default privileges.
- Sin CASCADE hacia tablas legales (las FKs nuevas CASCADE solo alcanzan a `casos`/`usuarios`, no a las legales).
- No se toca FE/BE: la firma `consume_quota(p_usuario_id, p_kind)` queda co-diseñada para BE; los endpoints son ticket aparte (Fase 2/3).