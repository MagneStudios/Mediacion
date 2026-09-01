# Pactum — Especificación de Monetización y Escalamiento a Abogado

**Versión:** 1.0 (draft para implementación)
**Fecha:** 2026-08-20
**Audiencia:** equipo de desarrollo
**Stack objetivo:** Next.js (App Router) + Supabase / Postgres + MercadoPago

> Este documento define **qué** hay que construir y **con qué reglas**. Los bloques marcados
> `⚠️ PENDIENTE` requieren una decisión de negocio antes de cerrar el sprint; están señalados
> con una propuesta por defecto para no bloquear el desarrollo.

---

## 1. Resumen ejecutivo

Pactum incorpora un modelo de suscripción con **3 planes** y un **producto transaccional de pago único**
(contratación de abogado) que se dispara manualmente desde una negociación.

| # | Plan | Precio | Límite principal | Cobro |
|---|------|--------|------------------|-------|
| 1 | **Particular** | USD 19.90 / mes | 3 negociaciones por mes | Suscripción MercadoPago |
| 2 | **Estudio Jurídico** | USD 59.90 / mes | 20 altas de clientes "Particular" por mes | Suscripción MercadoPago |
| 3 | **Corporativo** | A consultar | Sin límites por defecto | Fuera de plataforma (venta asistida) |
| — | **Abogado on-demand** | ARS 40.000 / USD 30 | Pago único por negociación | Checkout MercadoPago |

Adicionalmente: registrar el dominio **pactum.com** y aplicar la nueva identidad visual (ver §10).

---

## 2. Glosario

| Término | Definición operativa |
|---|---|
| **Negociación** | Unidad de trabajo del sistema: un caso/expediente entre dos o más partes. Es la entidad que se cuenta contra la cuota del plan Particular. |
| **Alta de cliente** | Un usuario de tipo `particular` creado por una cuenta de tipo `estudio` dentro de su cartera. Es la entidad que se cuenta contra la cuota del plan Estudio Jurídico. |
| **Cartera** | Conjunto de clientes `particular` vinculados a un `estudio`. |
| **Período de facturación** | Ventana de 30 días anclada al día de alta de la suscripción (ver §5.2). |
| **Escalamiento** | Acción manual del usuario dentro de una negociación para contratar asistencia legal profesional. |

---

## 3. Planes: definición funcional

### 3.1 Plan Particular — USD 19.90 / mes

- Destinado a personas físicas que gestionan sus propias negociaciones/mediaciones.
- **Cuota:** hasta **3 negociaciones creadas por período de facturación**.
- Se cuenta **la creación**, no la finalización. Una negociación creada y luego archivada/cancelada
  **sigue consumiendo** el cupo del período. (⚠️ PENDIENTE: definir si una negociación cancelada
  dentro de las primeras 24 h devuelve el cupo. Propuesta por defecto: **no devuelve**, para evitar
  el abuso de crear/borrar.)
- Al llegar a 3/3 el botón "Nueva negociación" queda deshabilitado con un mensaje de upgrade.
- Las negociaciones ya existentes **siguen siendo accesibles y operables** aunque la cuota esté agotada.
  El límite es sobre *crear*, nunca sobre *usar* lo ya creado.

### 3.2 Plan Estudio Jurídico — USD 59.90 / mes

- Destinado a estudios que gestionan casos en nombre de terceros.
- **Cuota:** hasta **20 altas de clientes tipo Particular por período de facturación**.
- El estudio opera dentro de la cuenta de cada cliente de su cartera (vista de "cambiar de cliente").
- ⚠️ **PENDIENTE — decisión crítica de negocio:** ¿cada cliente de la cartera hereda el límite de
  3 negociaciones/mes del plan Particular, o el estudio tiene negociaciones ilimitadas dentro de su cartera?
  **Propuesta por defecto (implementar así salvo indicación contraria):** cada cliente de la cartera
  hereda la cuota de 3 negociaciones/mes. Esto mantiene coherencia de precios (20 clientes × 3 = 60
  negociaciones/mes por USD 59.90) y evita canibalizar el plan Particular.
- ⚠️ **PENDIENTE:** el enunciado dice "crear hasta 20 clientes por mes", lo que se lee como *flujo*
  (altas mensuales) y no *stock* (cartera total). **Propuesta por defecto:** es **flujo** — el contador
  se resetea cada período y la cartera acumulada no tiene tope. Si negocio quiere un tope de cartera,
  agregar `max_clients_total` a la tabla `plans` (el schema de §4 ya lo contempla como nullable).

### 3.3 Plan Corporativo — a consultar

- **No hay checkout.** La tarjeta de pricing muestra un botón **"Consultar por WhatsApp"**.
- El botón abre `https://wa.me/<WHATSAPP_SALES_NUMBER>?text=<mensaje pre-cargado urlencoded>`
  en una pestaña nueva (`target="_blank" rel="noopener"`).
- Mensaje pre-cargado sugerido:
  `Hola, me interesa el plan Corporativo de Pactum. Mi empresa es ____.`
- Si el usuario está logueado, anexar al mensaje su email para trazabilidad.
- Registrar el click como evento analítico `pricing_corporate_whatsapp_click` (con `user_id` si existe).
- Internamente el plan existe en la tabla `plans` con `is_self_serve = false` y límites `NULL`
  (= ilimitado), y se asigna **a mano** por un admin cuando se cierra la venta.

---

## 4. Modelo de datos (Postgres / Supabase)

```sql
-- ─────────────────────────────────────────────────────────────
-- CATÁLOGO DE PLANES
-- ─────────────────────────────────────────────────────────────
create type account_type as enum ('particular', 'estudio', 'corporativo');

create table plans (
  code                text primary key,          -- 'particular' | 'estudio' | 'corporativo'
  name                text not null,
  account_type        account_type not null,
  price_usd_cents     integer,                   -- 1990 | 5990 | null (a consultar)
  is_self_serve       boolean not null default true,
  max_negotiations_per_period integer,           -- 3 | null(ilimitado, ver §3.2) | null
  max_clients_per_period      integer,           -- null | 20 | null
  max_clients_total           integer,           -- null (reservado, ver §3.2)
  mp_preapproval_plan_id      text,              -- id del plan en MercadoPago
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- Seed inicial
insert into plans (code, name, account_type, price_usd_cents, is_self_serve,
                   max_negotiations_per_period, max_clients_per_period) values
  ('particular',  'Particular',      'particular',   1990, true,  3,    null),
  ('estudio',     'Estudio Jurídico','estudio',      5990, true,  3,    20),
  ('corporativo', 'Corporativo',     'corporativo',  null, false, null, null);

-- ─────────────────────────────────────────────────────────────
-- CUENTAS Y SUSCRIPCIONES
-- ─────────────────────────────────────────────────────────────
create type subscription_status as enum (
  'pending',    -- creada, esperando autorización del pago
  'active',     -- authorized en MP, cuota disponible
  'past_due',   -- cobro rechazado, en período de gracia
  'paused',     -- pausada por el usuario o por MP
  'cancelled'   -- cancelada, sin acceso a features de pago
);

create table accounts (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  type          account_type not null,
  name          text not null,
  -- Cartera: si la cuenta es un cliente 'particular' creado por un estudio
  managed_by_account_id uuid references accounts(id),
  created_at    timestamptz not null default now()
);
create index on accounts (managed_by_account_id);

create table subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts(id) on delete cascade,
  plan_code          text not null references plans(code),
  status             subscription_status not null default 'pending',
  -- MercadoPago
  mp_preapproval_id  text unique,
  mp_payer_email     text,
  external_reference text unique not null,       -- 'acc_<account_id>_<nonce>'
  -- Facturación
  currency           text not null default 'ARS',
  amount_charged_minor integer not null,         -- monto real cobrado, en centavos ARS
  price_usd_cents    integer not null,           -- precio de lista de referencia
  fx_rate_used       numeric(12,4),              -- USD→ARS aplicado al momento del alta
  current_period_start timestamptz not null,
  current_period_end   timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index one_active_sub_per_account
  on subscriptions (account_id)
  where status in ('active','past_due','pending');

-- ─────────────────────────────────────────────────────────────
-- CONTADORES DE USO (fuente de verdad de las cuotas)
-- ─────────────────────────────────────────────────────────────
create table usage_counters (
  account_id    uuid not null references accounts(id) on delete cascade,
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  negotiations_created integer not null default 0,
  clients_created      integer not null default 0,
  primary key (account_id, period_start)
);

-- ─────────────────────────────────────────────────────────────
-- ESCALAMIENTO A ABOGADO (pago único)
-- ─────────────────────────────────────────────────────────────
create type lawyer_request_status as enum (
  'pending_payment', 'paid', 'notified', 'assigned', 'closed', 'refunded', 'failed'
);

-- Asume que la tabla `negotiations` ya existe en el sistema. Si el nombre real
-- difiere, ajustar la FK.
create table lawyer_requests (
  id                 uuid primary key default gen_random_uuid(),
  negotiation_id     uuid not null references negotiations(id) on delete cascade,
  account_id         uuid not null references accounts(id),
  requested_by_user_id uuid not null references auth.users(id),
  status             lawyer_request_status not null default 'pending_payment',
  -- Precio congelado al momento del click (ver §7.3)
  currency           text not null,              -- 'ARS' | 'USD'
  amount_minor       integer not null,           -- 4000000 (ARS) | 3000 (USD)
  -- MercadoPago
  mp_preference_id   text,
  mp_payment_id      text unique,
  external_reference text unique not null,       -- 'lawreq_<uuid>'
  -- Handoff al estudio
  whatsapp_notified_at timestamptz,
  case_summary       text,                       -- snapshot enviado al estudio
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index on lawyer_requests (negotiation_id);
create index on lawyer_requests (status);

-- ─────────────────────────────────────────────────────────────
-- AUDITORÍA DE WEBHOOKS (idempotencia)
-- ─────────────────────────────────────────────────────────────
create table payment_events (
  id            bigserial primary key,
  provider      text not null default 'mercadopago',
  event_type    text not null,        -- topic/action recibido
  resource_id   text not null,        -- data.id
  signature_ok  boolean not null,
  payload       jsonb not null,
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create unique index on payment_events (provider, event_type, resource_id);
```

### 4.1 RLS (Supabase)

- Todas las tablas anteriores con `enable row level security`.
- `accounts`: el usuario ve su cuenta propia **y** las cuentas donde `managed_by_account_id`
  pertenece a una cuenta suya de tipo `estudio`.
- `subscriptions`, `usage_counters`: solo lectura para el owner; **escritura únicamente vía
  `service_role`** (webhooks y RPCs). Nunca desde el cliente.
- `lawyer_requests`: lectura para el owner de la negociación; escritura vía RPC/service_role.

---

## 5. Reglas de negocio

### 5.1 Enforcement de cuotas — dónde y cómo

**Regla de oro: el límite se valida siempre en el servidor.** Ocultar el botón en el front es UX,
no seguridad. El chequeo va en una función Postgres transaccional para evitar carreras
(dos requests simultáneas creando la negociación #3 y #4).

```sql
create or replace function consume_quota(p_account_id uuid, p_kind text)
returns void language plpgsql security definer as $$
declare
  v_limit int; v_used int; v_start timestamptz; v_end timestamptz;
  v_billing_account_id uuid;
begin
  -- Resolver la suscripción EFECTIVA: si la cuenta es un cliente gestionado por
  -- un estudio, la cuota se descuenta contra la suscripción del estudio (ver §5.1.1).
  select coalesce(a.managed_by_account_id, a.id) into v_billing_account_id
    from accounts a where a.id = p_account_id;

  select current_period_start, current_period_end into v_start, v_end
    from subscriptions
   where account_id = v_billing_account_id and status in ('active','past_due')
   for update;

  if v_start is null then
    raise exception 'NO_ACTIVE_SUBSCRIPTION' using errcode = 'P0001';
  end if;

  insert into usage_counters (account_id, period_start, period_end)
  values (p_account_id, v_start, v_end)
  on conflict (account_id, period_start) do nothing;
  -- Nota: el contador se lleva por cuenta REAL (p_account_id) para poder mostrarle
  -- a cada cliente su propio uso; el período y el límite vienen del pagador.

  if p_kind = 'negotiation' then
    select p.max_negotiations_per_period into v_limit
      from subscriptions s join plans p on p.code = s.plan_code
     where s.account_id = v_billing_account_id;
    update usage_counters set negotiations_created = negotiations_created + 1
     where account_id = p_account_id and period_start = v_start
     returning negotiations_created into v_used;
  else
    select p.max_clients_per_period into v_limit
      from subscriptions s join plans p on p.code = s.plan_code
     where s.account_id = v_billing_account_id;
    update usage_counters set clients_created = clients_created + 1
     where account_id = p_account_id and period_start = v_start
     returning clients_created into v_used;
  end if;

  if v_limit is not null and v_used > v_limit then
    raise exception 'QUOTA_EXCEEDED' using errcode = 'P0002';
  end if;
end $$;
```

- `v_limit IS NULL` ⇒ **ilimitado** (plan Corporativo).
- La excepción hace rollback del `update`, así que el contador nunca queda inflado.
- El endpoint debe traducir `QUOTA_EXCEEDED` a **HTTP 402 Payment Required** con un body
  `{ error: 'quota_exceeded', limit, used, period_end, upgrade_url }` para que el front
  pinte el modal de upgrade sin adivinar.

### 5.1.1 Cuentas gestionadas por un Estudio

Los clientes que un estudio da de alta en su cartera son filas en `accounts` con
`managed_by_account_id = <id del estudio>` y **no tienen suscripción propia**. Por lo tanto:

- El **período de facturación** y los **límites** de un cliente gestionado se resuelven contra la
  suscripción del estudio que lo gestiona (`coalesce(managed_by_account_id, id)`).
- El **contador de uso** se guarda con el `account_id` del cliente real, para poder mostrarle a cada
  cliente su propio consumo y para que el estudio vea el desglose por cliente.
- Consecuencia directa de la decisión pendiente #3 (§3.2): con la propuesta por defecto, cada
  cliente de la cartera tiene sus 3 negociaciones/mes contadas por separado. Si negocio decide que
  el estudio tiene un pool compartido, basta con cambiar el `account_id` del `usage_counters` por
  `v_billing_account_id` — el resto del código no cambia.
- Si el estudio cae en `cancelled`, **todos** sus clientes gestionados pasan a solo lectura.

**Puntos de enforcement obligatorios:**

| Acción | Cuota que consume | Endpoint |
|---|---|---|
| Crear negociación | `negotiations_created` | `POST /api/negotiations` |
| Alta de cliente en cartera (estudio) | `clients_created` | `POST /api/clients` |
| Invitar contraparte a negociación existente | ninguna | — |
| Contratar abogado | ninguna (es pago aparte) | `POST /api/negotiations/:id/lawyer-request` |

### 5.2 Período de facturación y reseteo

- El período **se ancla al día de alta de la suscripción**, no al 1° de mes. Si alguien se suscribe
  el 14 de agosto, su período corre del 14/08 al 14/09.
- `current_period_start` / `current_period_end` se actualizan **al recibir el webhook de cobro
  autorizado** de MercadoPago (`subscription_authorized_payment`), nunca por un cron adivinando fechas.
- **Ventaja de esto:** el contador de uso se resetea creando una fila nueva en `usage_counters` con el
  nuevo `period_start`. No hay que borrar nada — queda el histórico completo para métricas.
- Job de contingencia diario: si `current_period_end < now()` y no llegó ningún webhook en 24 h,
  marcar `past_due` y loguear alerta. **No** extender el período automáticamente.

### 5.3 Estados de suscripción y acceso

| Estado | ¿Puede crear negociaciones? | ¿Puede operar las existentes? | ¿Puede contratar abogado? |
|---|---|---|---|
| `pending` | No | Solo lectura | No |
| `active` | Sí (hasta la cuota) | Sí | Sí |
| `past_due` | No | Sí (gracia de 7 días) | Sí |
| `paused` | No | Solo lectura | No |
| `cancelled` | No | Solo lectura (retención 90 días) | No |

- Período de gracia en `past_due`: **7 días** configurable (`GRACE_PERIOD_DAYS`). MercadoPago
  reintenta el cobro automáticamente; si al día 7 sigue rechazado ⇒ `cancelled`.
- Nunca se borran datos por falta de pago. Downgrade = pérdida de escritura, no de información.

### 5.4 Cambio de plan

- **Upgrade** (Particular → Estudio): efecto inmediato. Se cancela el preapproval anterior y se crea
  uno nuevo. ⚠️ PENDIENTE: MercadoPago no prorratea; **propuesta por defecto** = el nuevo plan arranca
  un período nuevo desde cero y se acredita el remanente como crédito manual (o simplemente se
  comunica que el cambio se hace efectivo al cierre del período en curso — decidir con negocio).
- **Downgrade** (Estudio → Particular): efectivo al **fin del período** (`cancel_at_period_end = true`).
  Si la cartera tiene más clientes de los que permite el plan destino, los clientes excedentes quedan
  en **solo lectura** — nunca se borran.

---

## 6. Integración MercadoPago — suscripciones

Referencia: [Suscripciones — Mercado Pago Developers](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/overview)

### 6.1 ⚠️ Advertencia sobre la moneda

Los precios están definidos en **USD (19.90 / 59.90)** pero **MercadoPago Argentina liquida
suscripciones en ARS** (`currency_id: "ARS"`). Implicancias:

1. Hay que guardar el precio de lista en USD (`price_usd_cents`) y el monto realmente cobrado en ARS
   (`amount_charged_minor` + `fx_rate_used`).
2. El monto del `preapproval_plan` en MP es **fijo en ARS**. Si el dólar se mueve, el precio real en
   USD se desfasa. Se necesita un procedimiento de actualización de precios:
   - Variable de entorno / tabla de config con el `USD_ARS_RATE` vigente.
   - Al cambiar el precio hay que **crear un plan nuevo en MP** y migrar suscriptores nuevos;
     los existentes conservan su monto hasta que se los actualice explícitamente (PUT sobre el preapproval).
   - **Comunicar el precio en el front en ARS** con la leyenda "equivalente a USD 19.90".
3. ⚠️ PENDIENTE con negocio: ¿ajuste de precio mensual automático por tipo de cambio, o precio ARS
   fijo revisado trimestralmente? **Propuesta por defecto:** ARS fijo, revisión trimestral (menos fricción
   y menos churn que reprecios mensuales).

### 6.2 Setup de planes (una sola vez, script de seed)

`POST https://api.mercadopago.com/preapproval_plan`

```json
{
  "reason": "Pactum — Plan Particular",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "transaction_amount": 24900,
    "currency_id": "ARS"
  },
  "payment_methods_allowed": {
    "payment_types": [{ "id": "credit_card" }, { "id": "debit_card" }]
  },
  "back_url": "https://pactum.com/billing/callback"
}
```

Guardar el `id` de la respuesta en `plans.mp_preapproval_plan_id`. Repetir para el plan Estudio.
(El `transaction_amount` del ejemplo es ilustrativo: calcularlo con el FX vigente al momento del seed.)

### 6.3 Alta de suscripción (checkout)

Flujo recomendado para v1: **checkout hospedado por MercadoPago** (menos superficie de PCI).

1. `POST /api/billing/subscribe` con `{ plan_code }`.
2. El backend crea la fila en `subscriptions` con `status='pending'` y un `external_reference` único.
3. `POST https://api.mercadopago.com/preapproval` con:
   ```json
   {
     "preapproval_plan_id": "<plans.mp_preapproval_plan_id>",
     "payer_email": "<email del usuario>",
     "external_reference": "<subscriptions.external_reference>",
     "back_url": "https://pactum.com/billing/callback",
     "status": "pending"
   }
   ```
4. Redirigir al usuario al `init_point` de la respuesta.
5. La activación **NO se hace en el callback** (el usuario puede cerrar el navegador).
   Se hace en el webhook (§6.4). El callback solo muestra "estamos confirmando tu pago…".

### 6.4 Webhooks

Endpoint: `POST /api/webhooks/mercadopago` — **público, sin auth de sesión, con validación de firma.**

**Topics a suscribir en el panel de MP:**

| Topic | Acción en Pactum |
|---|---|
| `subscription_preapproval` | Sincronizar `subscriptions.status` (`authorized`→`active`, `paused`→`paused`, `cancelled`→`cancelled`) |
| `subscription_authorized_payment` | Cobro recurrente OK ⇒ avanzar `current_period_start/end` +1 mes, `status='active'`. Cobro rechazado ⇒ `past_due` |
| `payment` | Pago único del abogado (§7) ⇒ actualizar `lawyer_requests` |

**Requisitos no negociables del handler:**

1. **Validar la firma** `x-signature` / `x-request-id` con `MP_WEBHOOK_SECRET` (HMAC-SHA256 sobre el
   manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`). Si falla ⇒ **401** y registrar en
   `payment_events` con `signature_ok = false`.
2. **Idempotencia:** insertar en `payment_events` con el índice único `(provider, event_type, resource_id)`.
   Si el insert choca ⇒ ya se procesó ⇒ responder **200** sin re-procesar. MercadoPago reenvía eventos.
3. **Responder 200 rápido (< 22 s)** y procesar el trabajo pesado (emails, WhatsApp) fuera del request
   o después de haber respondido. MP reintenta si tarda.
4. **Nunca confiar en el payload:** el webhook trae solo el `id`. Hacer siempre un `GET` a
   `/preapproval/{id}` o `/v1/payments/{id}` con el access token para leer el estado real.
5. Toda escritura de estado de suscripción pasa por `service_role`, jamás por el cliente.

---

## 7. Escalamiento: contratar abogado

### 7.1 Alcance de v1 (decidido)

**Solo botón manual.** No hay disparadores automáticos ni heurísticas de "la negociación escaló".
El usuario decide cuándo pedir ayuda profesional. Esto elimina la ambigüedad del criterio de
escalamiento y permite salir a producción sin definirlo.

> Nota para negocio: cuando exista data de uso, se puede agregar una *sugerencia* automática
> (ej.: N rondas sin acuerdo, monto sobre cierto umbral). El schema ya lo soporta —
> bastaría agregar `trigger_source` a `lawyer_requests`. **No implementar en v1.**

### 7.2 UX

- Dentro de la vista de negociación, un botón secundario persistente:
  **"Necesito un abogado"** (ícono de balanza / escudo).
- Visible siempre para suscripciones `active` y `past_due`. Para `pending`/`paused`/`cancelled`,
  se muestra deshabilitado con tooltip de reactivación.
- Al hacer click, modal con:
  - qué incluye el servicio (⚠️ PENDIENTE: copy y alcance exacto a definir con **Solmi & Asociados**:
    ¿es una consulta puntual, el patrocinio del caso completo, cuántas horas, plazo de respuesta?
    **Esto es bloqueante para publicar** — no se puede cobrar sin decir qué se entrega),
  - el precio,
  - el tiempo estimado de respuesta,
  - botón **"Contratar y pagar"**.

### 7.3 Precio

- **ARS 40.000** o **USD 30**, según el país/moneda de la cuenta.
- El precio se **congela** en `lawyer_requests.amount_minor` al momento de crear la solicitud.
  Si el usuario paga 2 horas después, paga el precio que vio. No re-cotizar en el webhook.
- Guardar en config (no hardcodear):
  ```
  LAWYER_FEE_ARS_MINOR=4000000   # ARS 40.000,00
  LAWYER_FEE_USD_MINOR=3000      # USD 30,00
  ```

### 7.4 Flujo técnico

1. `POST /api/negotiations/:id/lawyer-request`
   → valida permisos + suscripción activa
   → crea `lawyer_requests` con `status='pending_payment'` y `external_reference='lawreq_<uuid>'`
   → crea una **preference** de Checkout Pro:
   ```json
   {
     "items": [{
       "title": "Pactum — Asistencia legal profesional",
       "quantity": 1,
       "unit_price": 40000,
       "currency_id": "ARS"
     }],
     "external_reference": "lawreq_<uuid>",
     "notification_url": "https://pactum.com/api/webhooks/mercadopago",
     "back_urls": {
       "success": "https://pactum.com/negotiations/<id>?lawyer=ok",
       "pending": "https://pactum.com/negotiations/<id>?lawyer=pending",
       "failure": "https://pactum.com/negotiations/<id>?lawyer=error"
     },
     "auto_return": "approved"
   }
   ```
   → devuelve `init_point` al front.
2. Usuario paga en MercadoPago.
3. Webhook `payment` → `GET /v1/payments/{id}` → si `status == 'approved'`:
   - `lawyer_requests.status = 'paid'`, `paid_at = now()`, `mp_payment_id` guardado;
   - se dispara el handoff (§7.5).
4. Si `status` es `rejected`/`cancelled` ⇒ `failed`. La solicitud queda visible en la negociación
   con opción de reintentar (se genera una preference nueva, misma fila o fila nueva — decidir; se
   sugiere **fila nueva** para no perder el histórico de intentos).

### 7.5 Handoff al estudio (WhatsApp)

**v1 — manual asistido (recomendado para salir rápido):**
- Al confirmarse el pago, el backend genera un **resumen del caso** (`case_summary`) con:
  ID de negociación, nombre del solicitante, email, teléfono, contraparte, objeto de la negociación,
  monto en disputa si existe, fecha, y un **link de acceso** para el estudio.
- Se envía a un número de WhatsApp del estudio de Víctor.
- Se marca `whatsapp_notified_at`.
- **En paralelo, siempre enviar un email** al estudio con el mismo contenido. WhatsApp es el canal
  preferido, el email es el respaldo auditable. Si falla el envío de WhatsApp, el email garantiza que
  el caso pagado no se pierde.

**Implementación del envío:**
- ⚠️ PENDIENTE: definir si se usa la **WhatsApp Business Cloud API** (Meta) — requiere número
  verificado, cuenta de WhatsApp Business y **plantillas de mensaje pre-aprobadas** para poder iniciar
  conversación (no se puede mandar texto libre a un número que no escribió primero, dentro de la
  ventana de 24 h) — o un proveedor tipo Twilio.
- **Fallback para v1 si la API no está lista:** enviar el email + notificación interna, y mostrarle
  al usuario un botón `wa.me` con el mensaje pre-cargado para que **él mismo** inicie la conversación.
  Esto además abre la ventana de 24 h del lado de Meta y destraba mensajes posteriores.
- **Nunca** exponer datos sensibles de la negociación en la URL de `wa.me` — solo un identificador corto.

### 7.6 Riesgos a cubrir

| Riesgo | Mitigación |
|---|---|
| Se cobra y el estudio nunca se entera | Email de respaldo + alerta si `paid_at` tiene > 30 min y `whatsapp_notified_at is null` |
| Doble cobro por doble click | Índice único en `external_reference` + deshabilitar el botón tras el primer click + reusar la request `pending_payment` existente para la misma negociación |
| Usuario paga y pide reembolso | Definir política de reembolso **antes** del lanzamiento (⚠️ PENDIENTE). Estado `refunded` ya está en el enum |
| El estudio no puede tomar el caso | Flujo de `refunded` + comunicación. Debe existir un botón de admin para reembolsar vía API de MP |

---

## 8. Endpoints de API

```
# Planes y suscripción
GET    /api/plans                          → catálogo público con precios en ARS y USD
GET    /api/billing/subscription           → suscripción de la cuenta + uso del período actual
POST   /api/billing/subscribe              → { plan_code } → { init_point }
POST   /api/billing/cancel                 → cancel_at_period_end = true
POST   /api/billing/change-plan            → { plan_code } (ver §5.4)
GET    /api/billing/usage                  → { negotiations: {used,limit}, clients: {used,limit}, period_end }

# Cuotas / negociaciones
POST   /api/negotiations                   → 402 si QUOTA_EXCEEDED
POST   /api/clients                        → solo cuentas 'estudio'; 402 si QUOTA_EXCEEDED

# Abogado
POST   /api/negotiations/:id/lawyer-request  → { init_point }
GET    /api/negotiations/:id/lawyer-request  → estado actual

# Webhooks
POST   /api/webhooks/mercadopago           → público, firma validada, idempotente

# Admin
POST   /api/admin/accounts/:id/plan        → asignación manual del plan Corporativo
POST   /api/admin/lawyer-requests/:id/refund
```

**Contrato de error de cuota (HTTP 402):**
```json
{
  "error": "quota_exceeded",
  "resource": "negotiations",
  "used": 3,
  "limit": 3,
  "period_end": "2026-09-14T00:00:00Z",
  "upgrade_url": "/pricing?from=quota"
}
```

---

## 9. Front-end: qué construir

1. **Página de pricing** (`/pricing`) — 3 tarjetas. Particular y Estudio con botón "Suscribirme";
   Corporativo con "Consultar por WhatsApp". Precio principal en **ARS** con el equivalente en USD
   en letra chica (§6.1).
2. **Medidor de uso** en el dashboard: `2 de 3 negociaciones este mes` con barra de progreso y
   fecha de reseteo. Para estudios, además `7 de 20 clientes`.
3. **Modal de límite alcanzado** — se dispara con el 402, explica el límite y ofrece upgrade.
4. **Sección de facturación** (`/billing`) — plan actual, próximo cobro, historial, cancelar.
5. **Botón "Necesito un abogado"** dentro de la negociación + modal de contratación (§7.2).
6. **Estados de espera:** tras volver de MercadoPago, la suscripción puede tardar segundos en
   activarse (llega por webhook). Mostrar un estado "confirmando pago" con polling cada 3 s
   durante 60 s, no un error.

---

## 10. Identidad de marca

### 10.1 Dominio

- Adquirir **pactum.com**. Registrar también `pactum.com.ar` (defensivo, mercado local).
- Configurar desde el día 1: DNS, SSL, **registros SPF + DKIM + DMARC** para el email transaccional
  (crítico: los emails de pago no pueden caer en spam), y redirección `www` → apex.
- Reservar los handles sociales homónimos.
- ⚠️ Verificar disponibilidad y conflictos de marca antes de invertir en el diseño: "Pactum" es un
  término latino de uso común y existen empresas con ese nombre en el rubro legal/contratos.
  **Consultar disponibilidad en el INPI (Argentina) antes de cerrar la identidad.**

### 10.2 Logo

> ⚠️ **Superado el 01/09/2026.** El cliente eligió otro concepto: **cuatro figuras —dos mayores y
> dos menores— dentro de un contenedor redondeado** (pack `refugio`, ya integrado; ver
> `docs/respuestas-cliente-01-09-2026.md` §6 y `docs/changelogs/2026-09-01.md`). El brief de abajo
> queda como registro de lo que se había pedido, **no** como encargo vigente: si se le pasa a un
> diseñador, va a dibujar el logo equivocado.
>
> Dos requisitos de esta sección **siguen sin cumplirse** con el pack entregado y hay que
> resolverlos: la legibilidad a 16×16 px (el pack declara 32 px como mínimo, y a 16 px las figuras
> del medio se empastan) y los entregables que faltan — logotipo, lockup horizontal y vertical, y
> OG image de 1200×630. Lo entregado es sólo el isotipo.

Concepto: **una familia de 3 personas** — dos figuras (padres) en la parte superior y una figura
en el medio/abajo, formando una composición triangular.

Especificaciones para el diseñador:

- **Estructura:** triángulo con dos figuras arriba y una centrada abajo. La lectura buscada es
  "acuerdo entre partes con un tercero en el centro" — funciona tanto como familia
  como como mediación (las dos partes y el mediador). Aprovechar esa doble lectura.
- **Estilo:** geométrico, trazo simple, sin degradados. Debe funcionar en **1 color**.
- **Legibilidad mínima:** el isotipo debe leerse a **16×16 px** (favicon). Si a ese tamaño las tres
  figuras se empastan, simplificar formas antes que reducir espaciado.
- **Entregables requeridos:**
  - SVG del isotipo, del logotipo y de la versión combinada (lockup horizontal y vertical),
  - versiones en positivo, negativo y monocromo,
  - favicon (16/32/48), app icon (512, 1024), OG image (1200×630),
  - guía de uso: área de resguardo, tamaño mínimo, usos incorrectos.
- **Paleta:** ⚠️ PENDIENTE de definición. Sugerencia para un producto legal: un azul profundo o
  verde oscuro como primario (confianza/institucionalidad) + un acento cálido para los CTA.
  Verificar **contraste AA (4.5:1)** de todo texto sobre fondo antes de aprobar.
- **Tipografía:** una sola familia con buena variedad de pesos. Evitar tipografías con licencia
  restrictiva para uso web.

---

## 11. Configuración / variables de entorno

```bash
# MercadoPago
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=
MP_PLAN_PARTICULAR_ID=
MP_PLAN_ESTUDIO_ID=

# Precios
PRICE_PARTICULAR_USD_CENTS=1990
PRICE_ESTUDIO_USD_CENTS=5990
LAWYER_FEE_ARS_MINOR=4000000
LAWYER_FEE_USD_MINOR=3000
USD_ARS_RATE=

# Cuotas (los valores reales viven en la tabla plans; esto es solo fallback)
GRACE_PERIOD_DAYS=7

# WhatsApp
WHATSAPP_SALES_NUMBER=            # ventas plan Corporativo
WHATSAPP_LEGAL_NUMBER=            # estudio de Víctor (escalamiento)
WHATSAPP_PROVIDER_TOKEN=

# App
NEXT_PUBLIC_APP_URL=https://pactum.com
LEGAL_NOTIFICATION_EMAIL=
```

**Ninguno de estos valores va hardcodeado en el código.** Los precios y límites de plan viven en la
tabla `plans` para poder cambiarlos sin deploy.

---

## 12. Criterios de aceptación (QA)

### Cuotas
- [ ] Un Particular crea 3 negociaciones y la 4ta devuelve **402** con el body del §8.
- [ ] Dos requests **simultáneas** con 2/3 consumidas resultan en 3/3, no en 4/3.
- [ ] Archivar una negociación **no** devuelve el cupo.
- [ ] Al agotar la cuota, las negociaciones existentes **siguen siendo editables**.
- [ ] Tras el webhook de renovación, el contador arranca en 0 y el histórico anterior se conserva.
- [ ] Un Estudio crea 20 clientes y el 21° devuelve 402.
- [ ] Una cuenta Corporativo (límites `NULL`) crea 50 negociaciones sin bloqueo.
- [ ] Un usuario **no puede** superar su cuota llamando la API directamente con el token del front.

### Suscripciones
- [ ] Alta completa: checkout → webhook → `active` → cuota disponible.
- [ ] Si el usuario cierra el navegador tras pagar, la suscripción se activa igual (por webhook).
- [ ] Webhook duplicado (mismo `data.id`) no duplica períodos ni cobros.
- [ ] Webhook con firma inválida ⇒ **401** y queda registrado en `payment_events`.
- [ ] Cobro rechazado ⇒ `past_due`; a los 7 días sin regularizar ⇒ `cancelled`.
- [ ] En `cancelled` los datos siguen accesibles en solo lectura.

### Abogado
- [ ] El botón está visible en toda negociación con suscripción activa.
- [ ] Doble click no genera dos cobros.
- [ ] Pago aprobado ⇒ `paid` + notificación al estudio (WhatsApp y/o email) en < 1 min.
- [ ] Pago rechazado ⇒ `failed` y el usuario puede reintentar.
- [ ] El precio mostrado es el cobrado, aunque cambie la config entre el click y el pago.
- [ ] Alerta si un caso pagado lleva > 30 min sin notificar.

### General
- [ ] Ninguna escritura de estado de facturación es posible desde el cliente (probar con RLS activo).
- [ ] Todos los montos se manejan en **enteros de unidad mínima**, nunca en `float`.

---

## 13. Decisiones pendientes — bloqueantes para lanzar

| # | Decisión | Responsable | Bloquea |
|---|---|---|---|
| 1 | ¿Qué incluye exactamente el servicio de abogado de ARS 40.000? Alcance, plazo, entregable | **Solmi & Asociados** | Copy del modal + publicación |
| 2 | Política de reembolso del pago de abogado | Negocio + Solmi | Lanzamiento |
| 3 | ¿Los clientes de un Estudio heredan la cuota de 3 negociaciones/mes? (§3.2) | Negocio | Schema y enforcement |
| 4 | ¿20 clientes es flujo mensual o tope de cartera? (§3.2) | Negocio | Enforcement |
| 5 | Precio ARS fijo vs. ajuste por tipo de cambio (§6.1) | Negocio | Seed de planes en MP |
| 6 | Prorrateo en cambio de plan (§5.4) | Negocio | Endpoint change-plan |
| 7 | Proveedor de WhatsApp para el handoff (§7.5) | Técnico | Automatización del handoff (hay fallback) |
| 8 | Verificación de marca "Pactum" en INPI (§10.1) | Negocio | Inversión en identidad |
| 9 | Facturación fiscal: ¿se emite factura AFIP/ARCA por cada cobro? | Negocio / contador | Cumplimiento legal |

> El punto **9** no estaba en el brief original y conviene resolverlo temprano: cobrar
> suscripciones recurrentes en Argentina tiene obligaciones de facturación electrónica que, si se
> resuelven después, obligan a retrabajo (numeración, CUIT del cliente en el alta, condición
> frente al IVA, etc.). Conviene capturar los datos fiscales **en el momento de la suscripción**,
> aunque la emisión automática se implemente en una fase posterior.

---

## 14. Orden de implementación sugerido

1. **Fase 1 — Fundaciones:** tablas, RLS, seed de `plans`, función `consume_quota`, endpoints de uso.
   Se puede testear todo el enforcement de cuotas **sin tocar MercadoPago** asignando planes a mano.
2. **Fase 2 — Cobro recurrente:** seed de planes en MP, checkout, webhook con firma + idempotencia,
   estados de suscripción, página de billing.
3. **Fase 3 — Abogado:** botón, preference de pago único, webhook de `payment`, handoff por email
   (WhatsApp manual con `wa.me` como fallback).
4. **Fase 4 — Pricing y marca:** página de pricing, botón Corporativo a WhatsApp, logo y dominio.
5. **Fase 5 — Automatización:** WhatsApp Business API, facturación fiscal, panel de admin,
   métricas de conversión y churn.

Las fases 1 y 4 son independientes entre sí y pueden ir en paralelo.
