# Plan de Frontend — Monetización Pactum

**Fecha:** 23/08/2026 · **Autor:** Frontend · **Rama:** `feat/frontend-monetizacion-pactum` (desde `dev@52ff925`)
**Fuentes:** `docs/PACTUM-monetizacion-spec.md` v1.0 · `docs/contrato-spec-repo-monetizacion.md` · `docs/changelogs-db/2026-08-21.md` · `docs/decisiones-db/2026-08-21-monetizacion-fase1.md`

---

## 0 · Dónde estamos parados

| Capa | Estado |
|---|---|
| **DB** | Fase 1 mergeada (`20260821120000_monetizacion_fase1.sql`): columnas nuevas en `planes` y `suscripciones`, tablas `usage_counters` / `lawyer_requests` / `payment_events`, función `consume_quota`, RLS, seeds y `db-types` regenerados. |
| **BE** | **Nada.** Cero referencias a `consume_quota`, `usage_counters` o `lawyer_requests` en `apps/api/src`. `planColumns` sigue siendo las seis columnas viejas, así que `GET /planes` no expone `max_negotiations_per_period` ni `max_clients_per_period`. Las decisiones de DB lo dicen: *"los endpoints son ticket aparte (Fase 2/3)"*. |
| **FE** | Sin empezar. |

**Consecuencia operativa: hoy no podemos cablear nada real.** El camino es el mismo que funcionó en el ciclo de TyC — construir contra el mock con el shape ya acordado, publicar el contrato para que BE implemente sin ida y vuelta, y activar cambiando un singleton. La §4 de este plan es ese contrato.

El orden de merge del anexo sigue rigiendo: **DB → BE → FE**. DB ya está. Podemos trabajar en paralelo con mocks, pero no integramos hasta que exista la ficha de cada endpoint.

---

## 1 · Ocho desajustes que hay que resolver antes de escribir código

Salieron de cruzar el spec contra el repo real. Ninguno es opinión: los ocho están verificados en el código.

### 1.1 · El spec está escrito para otro stack

El encabezado dice *"Stack objetivo: Next.js (App Router) + Supabase / Postgres + MercadoPago"*. Este producto es **Expo Router + NestJS**. No es un detalle cosmético:

- Los `POST /api/...` del §8 son route handlers de Next en el spec; acá son rutas de Nest y las escribe BE, no nosotros.
- Las páginas `/pricing` y `/billing` del §9 son rutas de Expo Router (`app/pricing.tsx`, `app/billing/`), y tienen que funcionar en web **y** en nativo.
- El §9.6 pide "polling cada 3 s durante 60 s" al volver de MercadoPago. En web eso es un `back_url`; en nativo es un `Linking` de vuelta a la app y hay que resolver el deep link.

Nada de esto invalida el spec, pero cualquier estimación que lo lea literal va a estar mal.

### 1.2 · `GET /planes` ahora devuelve seis planes

El seed agregó `particular` y `corporativo` y dejó los legacy (`base`, `simple`, `plus`, `estudio`) intactos — decisión explícita de DB, "aditivo puro". Pero "Mi plan" (`app/profile/plan/index.tsx`) y el ABM de admin listan **lo que devuelva la API**, sin filtro.

El día que la migración toque una base viva, la pantalla de planes muestra **seis tarjetas**, tres de ellas de un modelo de precios que ya no existe.

**Falta decidir quién filtra.** Lo natural es que `GET /planes` devuelva solo los vigentes (una columna `activo`, que el spec §4 ya contempla como `plans.active`) y no que el front esconda filas por nombre.

### 1.3 · `corporativo` cuesta 0.00, igual que `base`

El contrato spec↔repo dice, sobre `is_self_serve`: *"No necesario: el front distingue por presencia de precio"*. Pero el seed es `('corporativo', -1, NULL, -1, 0.00, NULL, NULL)`: **el precio está presente y vale cero**, exactamente igual que el plan `base`, que sí es gratis.

Con ese dato el front **no puede** distinguir "a consultar" de "gratis", que es justo lo que el §3.3 del spec necesita para pintar "Consultar por WhatsApp" en vez de un botón de suscripción. La premisa del contrato no se cumple.

Hace falta `is_self_serve` en `planes`, o `precio NULL` para corporativo. Es de DB.

### 1.4 · Coexisten dos modelos de límite distintos, y nadie dijo cuál manda

| | Modelo viejo | Modelo nuevo |
|---|---|---|
| Columna | `planes.limite_casos` | `planes.max_negotiations_per_period` |
| Semántica | **stock** — casos activos simultáneos | **flujo** — creados por período de facturación |
| Enforcement | `PlanLimitService.assertCanCreateCase`, **vivo hoy** | `consume_quota`, **sin llamar desde ningún lado** |
| Error | `403 plan_limit_exceeded` | `402 quota_exceeded` (spec §8) |

Los dos aplican a la misma acción: crear un caso. El spec §12 exige *"archivar una negociación no devuelve el cupo"*, que es incompatible con un límite de stock — con `limite_casos`, archivar **sí** libera lugar.

Alguien tiene que decidir si el modelo viejo se retira o si conviven, y BE tiene que cablearlo. Nosotros solo necesitamos saber **qué error nos va a llegar** cuando el usuario no pueda crear.

### 1.5 · El error de límite que ya existe no lo maneja nadie en el front

`plan_limit_exceeded` tiene **cero referencias** en `mediacion-app`. Hoy un usuario que llegó a su límite de casos toca "Crear un caso" y recibe el mensaje de error genérico, sin decirle cuál es el límite ni ofrecerle upgrade.

O sea que el "modal de límite alcanzado" del §9.3 **no es una feature nueva: es un bug abierto**. Vale la pena construirlo primero, porque sirve para los dos códigos de error.

### 1.6 · La moneda: el spec responde la pregunta que dejamos abierta

En `docs/pedidos-frontend-a-backend.md` §7 dejamos abierto el punto #24 del instructivo de TyC preguntando en qué moneda están los precios. **El spec lo contesta** (§6.1): precios de lista en USD, cobro en ARS, y en el front *"comunicar el precio en ARS con la leyenda 'equivalente a USD 19.90'"*.

Nuestro `currency: 'USD'` hardcodeado en `utils/format-plan-limit.ts` sigue estando mal, pero ahora sabemos qué tiene que mostrar. Lo que falta es el dato:

- `planes.precio` es `numeric(10,2)` sin moneda. El seed pone `19.90`, que es el precio **USD** del spec.
- El spec §4 pide `price_usd_cents`, `amount_charged_minor` y `fx_rate_used`. Ninguno existe: el contrato spec↔repo los deja para Fase 2.
- Sin el monto en ARS y sin el FX, el front no puede mostrar el precio principal que el spec exige.

**Esto bloquea la página de pricing**, que es la mitad del trabajo visible de esta fase.

### 1.7 · "Negociación" vs "caso"

El spec habla de negociaciones; el repo, el schema y toda nuestra copy hablan de casos, y el contrato spec↔repo congeló `casos` sin renombrar. La copy visible es nuestra, pero el vocabulario del producto es de Producto. Si se adopta "negociación" hay que revisar `i18n/locales/{es-AR,en}.json` entero, no solo las pantallas nuevas.

### 1.8 · La marca

La app se llama **Mediación**: `<title>` en `app/_layout.tsx`, splash, i18n, nombre del paquete. El §10 pide Pactum, y está bloqueado por la verificación de marca en INPI (decisión #8 del spec). Es Fase 4 y no debería mezclarse con el resto.

---

## 2 · Lo que construimos, en orden

Fase A es todo lo que se puede hacer **sin BE**, contra mocks, siguiendo el patrón de `legal.service.ts`: un `createMockXService()` y un singleton que resuelve a la API cuando exista.

### Fase A — sobre mocks

| # | Tarea | Qué incluye | Depende de |
|---|---|---|---|
| **A1** | Capa de servicio de uso y cuota | `types/billing.ts` extendido (uso, período, límites, estado de suscripción completo), `services/usage.service.ts` con mock + factory, `services/api/usage.api-service.ts` escrito contra el contrato de §4 y **sin activar** | §4 acordado |
| **A2** | Medidor de uso en el dashboard | `2 de 3 negociaciones este mes` con barra y fecha de reseteo; para estudios además `7 de 20 clientes`. Estados cargando / vacío / error | A1 |
| **A3** | Modal de límite alcanzado | Se dispara con `402 quota_exceeded` **y con el `403 plan_limit_exceeded` que ya existe** (§1.5). Muestra límite, usado, fecha de reseteo y CTA de upgrade | A1 |
| **A4** | Gating por estado de suscripción | La matriz del spec §5.3 aplicada a la UI: qué se puede crear, operar y contratar en `pending` / `active` / `past_due` / `paused` / `cancelled`. **Es UX, no seguridad** — la garantía es el servidor | A1 |
| **A5** | Botón "Necesito un abogado" + modal | Botón secundario persistente en la vista de caso; modal con alcance, precio y tiempo de respuesta. **El copy es bloqueante** (§3) | A1, decisión #1 |
| **A6** | Estado "confirmando pago" | Tras volver de MercadoPago, polling cada 3 s hasta 60 s con estado explícito, nunca un error. Incluye resolver el retorno en nativo (§1.1) | A1 |
| **A7** | Página de pricing | Tres tarjetas; Particular y Estudio con "Suscribirme", Corporativo con "Consultar por WhatsApp" (`wa.me`, pestaña nueva, `rel="noopener"`, sin datos sensibles en la URL). Ruta pública, en la allowlist de `AuthGate` | §1.3 y §1.6 resueltos |
| **A8** | Sección de facturación | Ampliar `/profile/plan`: plan actual, próximo cobro, período, historial, cancelar. Reusa lo que ya hay de la baja | A1 |

**A7 arranca bloqueada** hasta que se resuelvan la moneda (§1.6) y el marcador de "a consultar" (§1.3). Todo lo demás se puede empezar hoy.

### Fase B — activación

Cambiar el singleton de cada servicio, como en TyC. Ninguna pantalla se toca. Requiere la ficha de cada endpoint publicada por BE.

### Fase C — marca

Renombre a Pactum: título, splash, iconos, i18n, dominio. Bloqueada por INPI (§1.8). No mezclar con A ni B.

---

## 3 · Lo que nos bloquea y no es nuestro

De las nueve decisiones pendientes del spec §13, estas cinco tocan al front:

| # | Decisión | Responsable | Qué bloquea de FE |
|---|---|---|---|
| 1 | Qué incluye el servicio de abogado de ARS 40.000 (alcance, plazo, entregable) | **Solmi & Asociados** | El copy del modal de A5. El spec ya lo marca como **bloqueante para publicar**: no se puede cobrar sin decir qué se entrega |
| 5 | Precio ARS fijo vs. ajuste por tipo de cambio | Negocio | La página de pricing (A7) y qué número mostramos |
| 6 | Prorrateo en cambio de plan | Negocio | El flujo de upgrade/downgrade en A8 |
| 9 | Facturación fiscal (AFIP/ARCA) | Negocio + contador | Si hay que **capturar datos fiscales en el alta**, eso es un formulario nuestro. El spec avisa que resolverlo después obliga a retrabajo |
| — | Filtrado del catálogo de planes (§1.2) | Producto + DB | Qué planes se muestran |

Las decisiones #3 y #4 ya tienen default implementado por DB y son reversibles; no nos bloquean.

---

## 4 · Lo que le pedimos a BE — contrato propuesto

Formato calcado de `docs/fichas-legal-backend.md`, para que se pueda implementar sin ida y vuelta. **Si algún shape no cierra, avisar antes de implementar.**

### 4.1 · `GET /suscripciones/uso`

Lo que alimenta A2, A3 y A4. Hoy no hay forma de saber cuánto consumió el usuario: `usage_counters` existe pero nada la expone.

| | |
|---|---|
| Auth | Bearer |
| Titularidad | La misma resolución que `GET /suscripciones/vigente` (personal antes que estudio, y solo el titular del estudio) |

```json
{
  "period_start": "2026-08-14T00:00:00.000Z",
  "period_end": "2026-09-14T00:00:00.000Z",
  "negociaciones": { "usado": 2, "limite": 3 },
  "clientes": { "usado": 7, "limite": 20 }
}
```

- `limite: null` ⇒ **ilimitado**, y la barra de progreso no se dibuja.
- `clientes` solo viene para cuentas de estudio; para el resto, `null`.
- **Sin suscripción activa** ⇒ `404 suscripcion_not_found`, el mismo código y el mismo criterio que `/vigente`, que ya mapeamos a "no tengo plan".
- Si `usage_counters` todavía no tiene fila para el período, devolver `usado: 0` — no un 404. La ausencia de fila es "no consumió nada", no "no existe".

### 4.2 · El error de cuota

El spec §8 define `402` con `{ error, resource, used, limit, period_end, upgrade_url }`. **Nuestro envelope de errores es otro** (`{ error: { code, message } }`, `common/filters/all-exceptions.filter.ts`), y romperlo por un caso rompe todos los demás.

Propuesta: mantener el envelope y colgar el detalle:

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

- `upgrade_url` **no hace falta**: la ruta de pricing la conoce el front y hardcodearla en el server nos ata a una URL de web en una app que también corre en nativo.
- Status `402`. Y decidir qué pasa con el `403 plan_limit_exceeded` que ya existe (§1.4): si los dos van a convivir, los dos necesitan este cuerpo, porque el modal es el mismo.

### 4.3 · `GET /planes` — dos columnas y un filtro

- Agregar `max_negotiations_per_period` y `max_clients_per_period` al allowlist `planColumns`: sin eso no podemos mostrar los límites de cada plan en la página de pricing.
- Resolver el filtrado del catálogo (§1.2) y el marcador de "a consultar" (§1.3).
- Y la moneda (§1.6): el shape que necesitamos para pintar el precio del spec §6.1 es el monto en ARS **y** el de referencia en USD.

### 4.4 · Abogado

`POST /casos/:id/solicitud-abogado` → `{ init_point }` y `GET /casos/:id/solicitud-abogado` → estado actual. Los shapes los definimos cuando el copy del modal esté cerrado (decisión #1), porque el alcance del servicio cambia qué mostramos.

---

## 5 · Lo que NO vamos a hacer en esta rama

- **No tocamos el checkout de suscripción hasta que exista `preapproval`.** Hoy `POST /suscripciones/:id/pago` devuelve un `init_point` de preferencia one-off, no confirma un pago, y no hay endpoint de factura. Ya está asentado en `docs/tyc-contrato-frontend.md` §10.5: cablearlo obligaría a la app a informar un pago aprobado por plata que nadie cobró.
- **No renombramos a Pactum** (Fase C, bloqueada por INPI).
- **No cambiamos `currency: 'USD'` a ciegas.** Se cambia cuando exista el monto en ARS, no antes: releer 19.90 como pesos sería peor que el bug actual.
- **No filtramos planes por nombre desde el front.** Si el catálogo trae planes que no van, se arregla en la fuente.

---

## 6 · Riesgo principal

El trabajo de esta fase se apoya entero en endpoints que **todavía no existen y que nadie tiene asignados**. DB entregó Fase 1 y dejó escrito que los endpoints son "ticket aparte"; no hay changelog de BE que los tome.

Construir las ocho tareas de Fase A contra mocks es útil y es lo que hicimos en TyC con buen resultado — pero si BE no arranca Fase 2, lo que queda es una capa de UI que no puede activarse, y el riesgo es repetir el problema que ya tuvimos: que alguien la active a las apuradas sin la revisión de la capa que la sabe leer.

**Antes de escribir código conviene confirmar que BE tiene la Fase 2 asignada.**

---

*Dudas o cambios a estos shapes: responder sobre este doc o en el PR de la rama.*
