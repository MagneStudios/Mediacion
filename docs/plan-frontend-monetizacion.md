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
| **A3** ✅ | Modal de límite alcanzado | Se dispara con `402 quota_exceeded` **y con el `403 plan_limit_exceeded` que ya existe** (§1.5). Muestra límite, usado, fecha de reseteo y CTA de upgrade | — (ver §7.1) |
| **A4** | Gating por estado de suscripción | La matriz del spec §5.3 aplicada a la UI: qué se puede crear, operar y contratar en `pending` / `active` / `past_due` / `paused` / `cancelled`. **Es UX, no seguridad** — la garantía es el servidor | A1 |
| **A5** ✅ | Botón "Necesito un abogado" + modal | Botón secundario persistente en la vista de caso; modal con alcance, precio y tiempo de respuesta. **No publicable hasta la decisión #1** (§7.3) | — (ver §7.3) |
| **A6** ✅ | Estado "confirmando pago" | Tras volver de MercadoPago, polling cada 3 s hasta 60 s con estado explícito, nunca un error | — (ver §7.2) |
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

> **Publicado el 23/08 en `docs/pedidos-frontend-monetizacion.md`**, que es la versión que lee Backend y la que vale. Lo de abajo es el borrador del que salió; si los dos discrepan, gana el publicado.

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

### 4.5 · El `back_url` del preapproval

La pantalla de confirmación de pago ya existe y vive en **`/billing/callback`** — la ruta que nombra el spec §6.3. Cuando armen el `preapproval`, ese es el `back_url`:

```
<APP_URL>/billing/callback
```

No hace falta que le agreguen parámetros: **la pantalla no lee ninguno**, a propósito (§7.2). Si mueven la ruta, avisen — es de las pocas cosas nuestras que quedan congeladas en una configuración de MercadoPago y no se puede cambiar de un solo lado.

La pantalla consulta `GET /suscripciones/vigente`, que ya existe, y espera a que `estado` pase a `activa`. **No necesitamos ningún endpoint nuevo para esto.**

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

**Actualización del 23/08.** Se escribieron igual tres tareas (A3, A5, A6) porque las tres se sostienen solas: A3 arregla un error que ya existía y no espera nada, A6 corre contra `GET /suscripciones/vigente` que ya existe, y A5 queda deliberadamente sin poder cobrar hasta que Solmi defina el alcance. Ninguna quedó "esperando activación" salvo en la parte que el contrato de §4 desbloquea.

Lo que **no** cambió es el riesgo: A1, A2, A4 y A7 siguen apoyadas en endpoints y decisiones que nadie tomó, y el contrato ya está publicado. **A partir de acá el cuello de botella no es nuestro.**

---

## 7 · Bitácora de implementación

Qué se construyó de verdad, en qué se apartó del plan y qué cambió de lo que creíamos al escribirlo. Se actualiza al cerrar cada tarea.

### 7.1 · A3 — Modal de límite alcanzado ✅ (23/08, commit `8a96f75`)

**Se apartó del plan en una cosa: no dependió de A1.** El plan la ponía dependiendo de la capa de servicio de uso, con la idea de que el modal leyera los límites de un endpoint. No hace falta: **la falla misma trae el detalle**. El modal se alimenta del error, no de una segunda consulta, y eso además lo deja funcionando contra el `403` que existe hoy sin ninguna infraestructura nueva.

Lo que entró:

| Archivo | Qué hace |
|---|---|
| `services/api/api-error.ts` | `ApiError` conserva el resto del envelope en `detail`. Antes se tiraba: `toApiError` leía solo `code` y `message`, así que los números del 402 se perdían en la puerta. Queda como bolsa sin tipar — es transporte, no sabe qué es facturación. Códigos nuevos: `quota_exceeded`, `plan_limit_exceeded` |
| `utils/quota-limit.ts` | Traduce las dos fallas a una sola forma `QuotaLimit`. Descarta números no usables (float, negativo, fecha imparseable) en vez de dibujarlos |
| `features/billing/components/QuotaLimitDialog.tsx` | El modal, sobre `ConfirmationDialog`. Sin reintentar |
| `app/case/create/review.tsx` | Lo consume; el resto de las fallas conserva su estado de error con reintento |

**Se degrada por diseño.** Hoy el `403` no trae números y la copy es verdadera sin ellos ("Tu plan no te permite crear más por ahora"). El día que BE mande `usado`/`limite`/`period_end`, el mismo modal dice "Tu plan incluye 3 negociaciones por período y ya usaste 3. El contador se renueva el 14 de septiembre de 2026" sin tocar una línea.

**Dos hallazgos que solo aparecieron en el navegador:**

1. **El modal quedaba pintado arriba de la pantalla siguiente y sin forma de cerrarlo.** `ConfirmationDialog` envuelve el `Modal` de RN con `animationType="fade"`, que no desmonta hasta que termina la animación de salida — y la animación no termina si la navegación congela la pantalla en el mismo gesto. "Ahora no" tampoco lo cerraba, porque la pantalla de atrás ya había dejado de re-renderizar. **Se desmonta el diálogo en vez de ocultarlo.**
2. Navegar desde el diálogo se difiere un commit, por el mismo motivo.

**Ninguno de los dos lo puede ver un test unitario:** RNTL desmonta el `Modal` en los dos casos y no distingue. Queda como nota para las tareas que sigan — cualquier modal de esta fase que navegue tiene el mismo problema.

### 7.2 · A6 — Estado "confirmando pago" ✅ (23/08)

**Es la primera tarea de esta fase que funciona contra endpoints reales.** No necesitó nada nuevo de BE: `GET /suscripciones/vigente` ya existe y devuelve `estado`, que es exactamente lo que hay que esperar que cambie a `activa`. Tampoco dependió de A1.

| Archivo | Qué hace |
|---|---|
| `features/billing/hooks/usePaymentConfirmation.ts` | El polling: 3 s de intervalo, 60 s de presupuesto, tres estados (`confirming` / `confirmed` / `stillPending`) |
| `app/billing/callback.tsx` | La pantalla del `back_url`. Sin `_layout` de grupo, igual que `case/[id]/payment-required` |

**La ruta es `/billing/callback`, la del spec §6.3, y eso es deliberado:** es el `back_url` que BE configura en el preapproval de MercadoPago, así que es un contrato externo y no puede moverse con nuestra navegación sin que BE cambie el preapproval. **Está en §4 como pedido a BE.**

Tres decisiones que vale la pena tener escritas:

- **No hay estado de error, y es a propósito** (spec §9.6). La plata del usuario ya salió; una pantalla roja diría que el pago falló cuando lo que pasó es que un webhook viene unos segundos atrás. Una lectura que falla es motivo para volver a preguntar, no para avisar que algo se rompió. Cuando se acaba el minuto se dice que está demorando, con el canal de contacto al lado — que es real y lo contesta alguien (punto #23 del instructivo).
- **No se lee nada de lo que MercadoPago pone en la URL.** Esos parámetros los controla cualquiera: una pantalla que creyera `?status=approved` regalaría un plan a quien tipee la URL. El spec §6.3.5 es explícito en que activa el webhook, no el redirect. Verificado en el navegador: con `?status=approved&collection_status=approved` sigue diciendo "estamos confirmando".
- **Polling con timeout encadenado, no `setInterval`.** Con una conexión lenta el intervalo apila pedidos que preguntan lo mismo y que pueden contestar fuera de orden. Y el presupuesto se mide **contra el reloj**, no contando intentos: con respuestas lentas, veinte intentos se pasan largo del minuto prometido.

**Un defecto de routing que apareció acá, sigue abierto, y va a molestar en A2, A7 y A8**

Navegar desde el callback a `/profile/plan` **aterriza en la URL correcta y renderiza otra pantalla del grupo** — la que el grupo tome por defecto. Se intentó arreglarlo el 23/08 y **no se logró**; lo que sigue es la caracterización, para que el próximo no repita el camino.

**Cómo se comporta, medido:**

| Origen | Destino | Resultado |
|---|---|---|
| `billing/callback` | `/profile/plan` | ❌ renderiza la default del grupo |
| `billing/callback` | `/profile/edit` | ❌ ídem — **no es por el subdirectorio `plan/`** |
| `billing/callback` | `/notices/activity` | ✅ |
| `billing/callback` | `/admin/planes/create` | ✅ — y **no** es la default del grupo, así que `admin` no es un falso positivo |
| `case/[id]/payment-required` | `/profile/plan` | ✅ |
| `case/create/review` | `/profile/plan` | ✅ |
| carga directa del navegador | `/profile/plan` | ✅ |

**Qué se descartó, cada uno con una prueba:**

- **El método de navegación.** Falla igual con `replace`, `push`, `navigate` y `<Link>`.
- **El `_layout` del grupo de origen.** Se borró `app/billing/_layout.tsx` y se desregistró del Stack raíz; sigue fallando, con el server reiniciado en limpio.
- **Los params de navegación.** Se instrumentó `useRootNavigationState`: en el caso que funciona y en el que falla, la ruta `profile` llega con **exactamente los mismos** `params: { screen: 'plan/index', params: {} }` y sin estado anidado. El payload es correcto; lo que se pierde es después.
- **El anchor.** Poniendo `unstable_settings = { anchor: 'account' }` en el grupo, el caso que falla pasa a renderizar `account` en vez de `edit`. O sea: **lo que se dibuja es el anchor, y el destino se descarta.** Pero agregar un anchor no arregla nada, sólo cambia a cuál se cae.
- **La colisión de nombres con el tab.** Existe `app/(tabs)/profile.tsx` (`/profile`) y el grupo `app/profile/` (`/profile/*`), que era la hipótesis más fuerte. **Se hizo el rename completo del grupo a `settings`** —17 archivos, 28 referencias, suite en verde— y **el bug persiste igual**. El rename se revirtió por eso: churn sin beneficio. Si alguien vuelve sobre esto, ese camino ya está descartado.

**Lo que queda como diferencia sin explicar:** `profile` tiene 6 rutas planas más el subdirectorio `plan/` (9 rutas); `admin` tiene sólo `planes/` (4) y `notices` una sola. El próximo paso razonable es bisecar el contenido del grupo hasta encontrar el umbral, y si resulta ser interno de expo-router, abrir un issue con el repro mínimo en vez de seguir peleándolo acá.

**Mientras tanto** el botón del callback va al inicio. Mandar a alguien que acaba de pagar a un formulario de perfil que no pidió es peor que mandarlo a la app.

**Lo otro que queda sin resolver:** el retorno en **nativo**. En web el `back_url` es una URL y funciona; en nativo hay que resolver el deep link de vuelta a la app, y eso depende de tener un esquema de URL y el dominio configurado (§1.1, §1.8). La pantalla está lista para los dos casos; lo que falta es cómo se llega a ella fuera del navegador.

### 7.3 · A5 — Botón "Necesito un abogado" ✅ (23/08)

Tampoco dependió de A1. Lo que entró:

| Archivo | Qué hace |
|---|---|
| `types/lawyer.ts` | Espeja `lawyer_requests` y el enum `estado_solicitud_abogado` (7 valores) del schema real |
| `services/lawyer.service.ts` | Mock con `getOffer` / `getRequest` / `requestLawyer`. Reusa la solicitud `pendiente_pago` del mismo caso — mitad de la defensa contra el doble cobro del §7.6; la otra mitad es el índice único, que es de la base |
| `utils/subscription-access.ts` | `canRequestLawyer`: la porción del §5.3 que esta tarea necesita. `activa` y `vencida` (= `past_due`, con sus 7 días de gracia) sí; el resto no |
| `utils/format-money.ts` | Formatea unidades mínimas enteras con la moneda que trae el dato. **Es lo contrario de `formatPlanPrice`**, que fija `'USD'` para toda la app (§1.6): cuando el punto #24 se resuelva, esta es la que debería quedar |
| `features/lawyer/components/LawyerRequestButton.tsx` | Botón + modal, autocontenido: se lee su propia suscripción y su propia oferta |

**La decisión que define esta tarea: el bloqueo se muestra, no se disimula.** El alcance del servicio de ARS 40.000 lo debe Solmi (decisión #1), y el spec la marca como *bloqueante para publicar* — "no se puede cobrar sin decir qué se entrega". Así que `LawyerServiceOffer.scope` es nullable, hoy es `null`, el modal dice *"Todavía no podemos publicar qué incluye este servicio… No vamos a cobrarte por algo que no podemos describir"* y **"Contratar y pagar" queda deshabilitado**. Es el mismo criterio que los `[COMPLETAR]` visibles de los textos legales. Cuando Solmi entregue, cambia el dato y nada más.

**No poner esto en producción antes de la decisión #1.** El botón es visible y el modal explica; con usuarios reales eso es una promesa a medias. Es construible ahora, publicable después.

**Un hallazgo de paso: `EstadoSuscripcion` se había quedado atrás del schema.** La migración de monetización agregó `pausada` al enum, `db-types` lo tiene, `Suscripcion["estado"]` de BE deriva de ahí y `GET /suscripciones/vigente` devuelve la columna tal cual — o sea que el valor ya podía llegar al front. Nuestro tipo tenía cuatro valores. Agregarlo **rompió `tsc`** en el `never` de `getSubscriptionNotice` (el guard haciendo exactamente lo suyo) y obligó a manejarlo: sin eso, Mi plan no decía nada para una suscripción pausada. Vale revisar los otros tipos de `types/` contra el schema nuevo antes de A2.


### 7.4 · Lo que aprendimos sobre los tests en esta fase

- `render` de RNTL **devuelve una promesa** en esta configuración. Destructurar `render(...)` da `undefined` y `screen` queda sin poblar con un error engañoso (`render function has not been called`). Siempre `await render(...)`, y `screen.unmount()` también quiere su propio `act`.
- Mientras un `Modal` está abierto, RNTL trata el resto del árbol como inerte: los elementos están en el árbol pero no son consultables. Es el comportamiento correcto, pero hay que asertar **después** de cerrar el diálogo, no mientras está arriba.
- **Un `waitFor` que no esperaba nada era un test flaky.** "advances to the invitation step" de `review.test.tsx` fallaba de a ratos por timeout. La causa no era una carrera: `fireEvent` corre dentro de `act`, así que el `await` ya vacía la microtask del mock resuelto y el assert es cierto apenas vuelve. Lo único que agregaba el `waitFor` era **un presupuesto de un segundo de reloj**, y con la caché de jest fría ese archivo tardó 5,5 s en arrancar y lo agotó. Arreglado sacando el `waitFor`, no agrandándole el timeout. Los tres `waitFor` que quedan en ese archivo sí esperan algo real: que el modal se desmonte.
- La verificación en navegador encontró **los tres** defectos de esta tanda (el modal pegado, la navegación difícil de cerrar y el routing a la pantalla equivocada) y los tests unitarios ninguno. Vale la pena presupuestar el paso por el navegador en cada tarea de esta fase, no dejarlo para el final.

---

*Dudas o cambios a estos shapes: responder sobre este doc o en el PR de la rama.*
