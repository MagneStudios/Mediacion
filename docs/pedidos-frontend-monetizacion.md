# Pedidos de Frontend — Monetización Pactum

**Fecha:** 23/08/2026 · **Autor:** Frontend · **Para:** Backend (§3), y **DB + Producto** (§5)
**Origen:** `docs/PACTUM-monetizacion-spec.md` v1.0 · `docs/contrato-spec-repo-monetizacion.md` · `docs/changelogs-db/2026-08-21.md`
**Rama de FE:** `feat/frontend-monetizacion-pactum` · **Plan completo:** `docs/plan-frontend-monetizacion.md`

El recíproco de `docs/fichas-legal-backend.md`, para el módulo de monetización. Mismo formato que el ciclo de TyC, que salió bien: shapes listos para implementar, sin ida y vuelta. **Si algún shape no les cierra, avisen antes de implementar** — es más barato ajustar el contrato que descubrirlo integrando.

---

## 1 · Dónde estamos los tres

| Capa | Estado |
|---|---|
| **DB** | Fase 1 entregada (`20260821120000_monetizacion_fase1.sql`): columnas nuevas en `planes` y `suscripciones`, tablas `usage_counters` / `lawyer_requests` / `payment_events`, `consume_quota`, RLS, seeds, `db-types` regenerados. |
| **BE** | Sin empezar. Cero referencias a `consume_quota`, `usage_counters` o `lawyer_requests` en `apps/api/src`; `planColumns` sigue con las seis columnas viejas. Las decisiones de DB lo dejaron escrito: *"los endpoints son ticket aparte (Fase 2/3)"*. |
| **FE** | Tres pantallas construidas contra mock, esperando estos endpoints (§2). |

Este documento es lo que falta en el medio.

---

## 2 · Lo que ya está construido y qué espera de ustedes

Para que se vea que el consumidor existe y qué se rompe si el shape cambia.

| Qué construimos | Dónde | Qué endpoint espera |
|---|---|---|
| Modal de límite alcanzado | `features/billing/components/QuotaLimitDialog.tsx` | El error de cuota de **§3.2**. Ya funciona con el `403 plan_limit_exceeded` que existe hoy |
| Confirmación de pago con polling | `app/billing/callback.tsx` | **Nada nuevo**: usa `GET /suscripciones/vigente`, que ya existe. Sólo necesita el `back_url` de **§3.4** |
| Botón "Necesito un abogado" + modal | `features/lawyer/components/LawyerRequestButton.tsx` | **§3.5**, cuando el alcance esté definido |
| Medidor de uso en el dashboard | *sin construir* | **§3.1** — es lo que la bloquea |

---

## 3 · Los pedidos

### 3.1 · `GET /suscripciones/uso` — el que más falta

**Qué desbloquea:** el medidor de uso del spec §9.2 (*"2 de 3 negociaciones este mes"*), y que el modal de límite pueda anticiparse en vez de aparecer recién cuando el usuario choca contra la pared.

Hoy no hay forma de saber cuánto consumió alguien: `usage_counters` existe y nada la expone.

| | |
|---|---|
| Auth | Bearer |
| Titularidad | **La misma resolución que `GET /suscripciones/vigente`** — personal antes que estudio, y sólo el titular del estudio (`rol = 'estudio'`, `activo`). Si difiere, un usuario vería el uso de otro |
| Módulo | `pagos/suscripciones.controller.ts` |

```json
{
  "period_start": "2026-08-14T00:00:00.000Z",
  "period_end": "2026-09-14T00:00:00.000Z",
  "negociaciones": { "usado": 2, "limite": 3 },
  "clientes": { "usado": 7, "limite": 20 }
}
```

- **`limite: null` ⇒ ilimitado.** Es el plan Corporativo (`max_negotiations_per_period` NULL). La barra de progreso no se dibuja y no se muestra ningún número de tope.
- **`clientes` sólo para cuentas de estudio**; para el resto, `null` entero (no `{ usado: 0, limite: null }`, que se leería como "tenés cupo ilimitado de clientes").
- **Sin fila en `usage_counters` para el período ⇒ `usado: 0`, no un 404.** La ausencia de fila es "no consumió nada", no "no existe" — `consume_quota` crea la fila recién en el primer consumo.
- **Sin suscripción activa ⇒ `404 suscripcion_not_found`**, el mismo código y el mismo criterio que `/vigente`, que ya mapeamos a "no tengo plan". No inventen un código nuevo para el mismo estado.
- `period_start` / `period_end` salen de la suscripción **del pagador** (el estudio, si es una cuenta gestionada), mientras que los contadores salen de la cuenta real — que es exactamente lo que hace `consume_quota`. Lo aclaramos porque es el punto donde es fácil cruzar los dos.

Timestamps por `normalizeTimestamp`, como el resto.

### 3.2 · El error de cuota — y un choque con el envelope

El spec §8 define el 402 así:

```json
{ "error": "quota_exceeded", "resource": "negotiations", "used": 3, "limit": 3, "period_end": "…", "upgrade_url": "/pricing?from=quota" }
```

**Ese cuerpo no entra en este repo.** El envelope global es `{ "error": { "code", "message" } }` (`common/filters/all-exceptions.filter.ts`) y romperlo para un caso rompe el manejo de todos los demás.

**Lo que proponemos:** mantener el envelope y colgar el detalle adentro.

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "…",
    "recurso": "negociaciones",
    "usado": 3,
    "limite": 3,
    "period_end": "2026-09-14T00:00:00.000Z"
  }
}
```

- Status **402**.
- `recurso` ∈ `negociaciones` | `clientes`.
- **`upgrade_url` no lo manden.** La ruta la conoce el front, y hardcodear una URL de web en el servidor nos ata en una app que también corre en nativo.
- **Todo el detalle es opcional de nuestro lado.** Ya lo manejamos ausente: el modal se degrada a una copy sin números y sigue siendo verdadera. Si el detalle complica algo, mándenlo sin él y funciona igual — sólo dice menos.

**Y una pregunta que sí necesitamos respondida:** hoy existe **`403 plan_limit_exceeded`** (`PlanLimitService.assertCanCreateCase`), que es un límite de *stock* sobre `limite_casos`, mientras `consume_quota` es de *flujo* sobre `max_negotiations_per_period`. Los dos gobiernan la misma acción: crear un caso.

Para el usuario son la misma pared y les damos la misma pantalla, así que **no nos bloquea**. Pero alguien tiene que decidir si el modelo viejo se retira o si conviven, porque el criterio de QA del spec §12 —*"archivar una negociación no devuelve el cupo"*— es incompatible con un límite de stock: con `limite_casos`, archivar **sí** libera lugar.

Lo único que necesitamos saber es **qué código nos va a llegar** cuando el usuario no pueda crear. Si conviven, los dos deberían traer el mismo cuerpo de arriba.

### 3.3 · `GET /planes` — dos columnas que faltan

`planColumns` (`pagos/pagos.types.ts`) sigue con las seis viejas. Para la página de pricing necesitamos las dos que agregó DB:

- `max_negotiations_per_period`
- `max_clients_per_period`

Es agregarlas al allowlist; el compile-guard que ya tienen se encarga del resto.

**Ojo con dos cosas que no son de ustedes pero salen por esta ruta** — están en §5, y las dos bloquean la página de pricing.

### 3.4 · El `back_url` del preapproval — ya está construido

La pantalla de confirmación de pago existe y vive en **`/billing/callback`**, la ruta que nombra el spec §6.3. Cuando armen el `preapproval`:

```
back_url: <APP_URL>/billing/callback
```

- **No hace falta que le agreguen parámetros.** La pantalla no lee ninguno, a propósito: los que pone MercadoPago los controla cualquiera, y una pantalla que creyera `?status=approved` le daría un plan a quien tipee la URL. Activa el webhook, como dice el §6.3.5.
- La pantalla consulta `GET /suscripciones/vigente` cada 3 s hasta 60 s esperando que `estado` pase a `activa`. **No necesitamos ningún endpoint nuevo para esto.**
- **Si mueven la ruta, avisen.** Es de las pocas cosas nuestras que quedan congeladas en una configuración de MercadoPago y no se puede cambiar de un solo lado.

### 3.5 · Abogado — todavía no congelamos el shape, y es a propósito

`POST /casos/:id/solicitud-abogado` → `{ init_point }` y `GET /casos/:id/solicitud-abogado` → estado actual.

**No los especificamos en detalle todavía** porque el alcance del servicio (decisión #1 del spec, de Solmi & Asociados) cambia qué campos necesita la pantalla, y congelar un shape antes de saberlo es cómo se arma un contrato que hay que renegociar. El spec lo marca como *bloqueante para publicar*: "no se puede cobrar sin decir qué se entrega".

Lo que sí les sirve saber ahora:

- El precio se **congela** en `lawyer_requests.monto_minor` al crear la solicitud, no se re-cotiza en el webhook (spec §7.3). Nuestro modal ya muestra el precio que trae la oferta.
- Ante un segundo intento sobre el mismo caso, **reusar la solicitud `pendiente_pago` existente** en vez de crear otra (spec §7.6). Nuestro mock ya lo hace de este lado; la garantía es de ustedes más el índice único.
- Montos en **unidades mínimas enteras**, nunca float.

Cuando Solmi entregue el alcance, mandamos la ficha completa.

---

## 4 · Lo que **no** les pedimos

Para que no construyan de más:

- **Nada de checkout de suscripción todavía.** Seguimos sin cablearlo mientras `POST /suscripciones/:id/pago` devuelva un `init_point` de preferencia one-off en vez de confirmar un pago, y no haya endpoint de factura. Ya está asentado en `docs/tyc-contrato-frontend.md` §10.5.
- **Ningún endpoint de `usage_counters` por cliente para el estudio.** El desglose por cliente del spec §5.1.1 es útil pero no lo consume ninguna pantalla nuestra hoy.
- **`upgrade_url`** (ver §3.2).

---

## 5 · Dos cosas que salen por `GET /planes` y son de DB + Producto

Las dos bloquean la página de pricing, que es la mitad del trabajo visible que nos queda.

### 5.1 · `corporativo` cuesta `0.00`, igual que `base`

`docs/contrato-spec-repo-monetizacion.md` dice, sobre `is_self_serve`: *"No necesario: el front distingue por presencia de precio"*. Pero el seed es `('corporativo', -1, NULL, -1, 0.00, NULL, NULL)`: **el precio está presente y vale cero**, exactamente igual que el plan `base`, que sí es gratis.

Con ese dato **no podemos distinguir "a consultar" de "gratis"**, que es justo lo que el spec §3.3 necesita para pintar "Consultar por WhatsApp" en vez de un botón de suscripción. La premisa del contrato no se cumple.

Hace falta `is_self_serve` en `planes`, o `precio NULL` para corporativo. Cualquiera de las dos nos sirve.

### 5.2 · El catálogo devuelve seis planes

El seed agregó `particular` y `corporativo` y dejó los legacy (`base`, `simple`, `plus`, `estudio`) — decisión explícita de DB, aditivo puro. Pero "Mi plan" y el ABM de admin listan lo que devuelva la API, sin filtro: **el día que la migración toque una base viva se ven seis tarjetas**, tres de un modelo de precios que ya no existe.

**No lo vamos a filtrar por nombre desde el front.** Si el catálogo trae planes que no van, se arregla en la fuente — el spec §4 ya contempla `plans.active` para eso.

### 5.3 · La moneda (esto además cierra el punto #24 del instructivo de TyC)

En `docs/pedidos-frontend-a-backend.md` §7 dejamos abierto el punto #24 preguntando en qué moneda están los precios. **El spec lo contesta** (§6.1): precios de lista en USD, cobro en ARS, y en el front *"comunicar el precio en ARS con la leyenda 'equivalente a USD 19.90'"*.

Pero el dato no existe: `planes.precio` es `numeric(10,2)` sin moneda, el seed pone `19.90` —que es el precio **USD**— y `price_usd_cents` / `amount_charged_minor` / `fx_rate_used` quedaron para Fase 2.

**Sin el monto en ARS no podemos mostrar el precio principal que el spec exige.** No vamos a releer `19.90` como pesos: sería peor que el bug actual.

---

## 6 · Una nota sobre los tipos

`EstadoSuscripcion` de FE se había quedado en cuatro valores mientras la migración agregó **`pausada`** al enum. `db-types` lo tiene, `Suscripcion["estado"]` de ustedes deriva de ahí, y `GET /suscripciones/vigente` devuelve la columna tal cual — o sea que el valor **ya podía llegar a la app** como algo que el front no conocía. Ya lo arreglamos de nuestro lado.

No es un reproche: es que cuando DB agrega un valor de enum, la punta que lo consume no se entera por ningún lado. Si al implementar estos endpoints agregan o cambian un enum, alcanza con una línea en el changelog diciendo cuál.

---

## 7 · Cómo lo activamos

Igual que en TyC: cada servicio de FE tiene su mock y su singleton, y activar es cambiar una línea sin tocar ninguna pantalla. No integramos hasta que exista la ficha de cada endpoint (§06 del anexo de reparto).

**El orden que más nos sirve:** §3.3 (dos columnas, es chico) → §3.1 (`/uso`, desbloquea el medidor) → §3.2 (el 402) → §3.4 (`back_url`, cuando armen el preapproval) → §3.5 (abogado, cuando Solmi defina).

---

*Dudas o cambios a estos shapes: responder sobre este doc.*
