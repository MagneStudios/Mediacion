# Contrato spec↔repo — Monetización Pactum Fase 1

**Fecha:** 2026-08-21
**Estado:** Propuesta (pendiente aprobación antes de merge)
**Origen:** `docs/PACTUM-monetizacion-spec.md` v1.0 (2026-08-20)

## Equivalencias congeladas

| Spec (PACTUM §4) | Repo actual | Acción DB |
|---|---|---|
| `plans` (code TEXT PK) | `planes` (UUID PK, nombre TEXT UNIQUE) | **Extender `planes`** con columnas nuevas; no crear tabla paralela |
| `accounts` (id UUID, owner_user_id, type, managed_by_account_id) | `usuarios` + `estudios` (con `managed_by` implícito vía caso_partes) | **No crear** — el repo ya modela esto |
| `subscriptions` (account_id → accounts) | `suscripciones` (usuario_id/estudio_id XOR → usuarios/estudios) | **Extender `suscripciones`** con campos de billing/MP |
| `negotiations` | `casos` | `lawyer_requests.caso_id → casos(id)` |
| `accounts(id)` en nuevas FKs | `usuarios.id` / `estudios.id` | FKs apuntan a las tablas reales del repo |

## Mapeo de columnas

### planes (extensión)

| Spec | Repo (nueva columna) | Tipo | Default | Notas |
|---|---|---|---|---|
| `code` | `nombre` (ya existe) | TEXT UNIQUE | — | PK lógico existente |
| `max_negotiations_per_period` | `max_negotiations_per_period` | INT | NULL | 3 para particular; NULL = ilimitado |
| `max_clients_per_period` | `max_clients_per_period` | INT | NULL | 20 para estudio; NULL = ilimitado |
| `is_self_serve` | — | — | — | No necesario: el front distingue por presencia de precio |
| `mp_preapproval_plan_id` | — | — | — | Fase 2 (webhooks MP) |

Columnas existentes conservadas: `limite_carpetas`, `limite_casos`, `limite_iteraciones_ia`, `precio`.

### suscripciones (extensión)

| Spec | Repo (nueva columna) | Tipo | Default |
|---|---|---|---|
| `current_period_start` | `current_period_start` | TIMESTAMPTZ | NULL |
| `current_period_end` | `current_period_end` | TIMESTAMPTZ | NULL |
| `cancel_at_period_end` | `cancel_at_period_end` | BOOLEAN | false |
| `mp_preapproval_id` | `mp_preapproval_id` | TEXT UNIQUE | NULL |
| `mp_payer_email` | `mp_payer_email` | TEXT | NULL |

Nuevo valor de enum `estado_suscripcion`: `'pausada'` (equivalente a `paused` del spec). `'vencida'` ya existía y es el equivalente a `past_due`.

### Nuevas tablas

| Tabla | Spec | Repo | FK principal |
|---|---|---|---|
| `usage_counters` | `usage_counters` | `usage_counters` | PK `(usuario_id, period_start)`; FK `usuario_id → usuarios(id) ON DELETE CASCADE`. Contador por usuario real (cliente de estudio incluido, default #3/#4); el período viene de la suscripción del pagador |
| `lawyer_requests` | `lawyer_requests` | `lawyer_requests` | `caso_id → casos(id) ON DELETE CASCADE` (negotiations → casos) |
| `payment_events` | `payment_events` | `payment_events` | Sin FK (log de webhooks) |

### consume_quota

| Spec | Repo |
|---|---|
| `consume_quota(p_account_id UUID, p_kind TEXT)` | `consume_quota(p_usuario_id UUID, p_kind TEXT)` |
| Resuelve vía `accounts.managed_by_account_id` | Resuelve vía `usuarios.estudio_id`: suscripción propia primero, si no la del estudio que lo gestiona; `FOR UPDATE` serializa el consumo concurrente |
| `QUOTA_EXCEEDED` ERRCODE `P0002` | Igual |
| `NO_ACTIVE_SUBSCRIPTION` ERRCODE `P0001` | Igual (+ `NO_BILLING_PERIOD` P0001 si falta período de facturación) |

## Nombres congelados post-merge

- `max_negotiations_per_period`, `max_clients_per_period` en `planes`
- `current_period_start`, `current_period_end`, `cancel_at_period_end`, `mp_preapproval_id`, `mp_payer_email` en `suscripciones`
- `usage_counters`, `lawyer_requests`, `payment_events` como tablas
- `consume_quota` como función
- `estado_suscripcion` incluye `'pausada'` (nuevo); `'vencida'` ya existía (= `past_due` del spec)
- No se renombran tablas existentes (`casos` no se renombra a `negotiations`)

## Limitaciones de Fase 1

- `mp_preapproval_plan_id` en planes → Fase 2
- Webhook handler → Fase 2
- Checkout flow → Fase 2
- WhatsApp handoff → Fase 3
- Página pricing → Fase 4
