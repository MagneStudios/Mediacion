# Plan de implementación — Cambios cliente 27/08/2026 (C-01…C-08)

**Fuente:** `docs/Cambios_Cliente_Pactum_27-08-2026.md` (Solmi & Asociados, revisión legal)
**Precedente:** `docs/plan-implementacion-07-08-2026.md` (R-01…R-13, reunión 07/08)
**Estado de este plan:** propuesta de equipo. Cuatro de los ocho puntos no se pueden implementar como están escritos — ver §4.

---

## 0 · Lo primero: el documento describe una app que no es exactamente la nuestra

El pedido llegó escrito sobre un modelo mental del producto que no coincide con el código en varios puntos. No es un problema del cliente —es feedback legal, no técnico— pero sí cambia el plan, porque tres ítems que el documento presenta como "cambios chicos" no tienen objeto sobre el cual aplicarse, y uno que presenta como "feature nueva y simple" choca con dos cosas ya construidas.

| Punto | Lo que el documento supone | Lo que hay en el repo |
|---|---|---|
| C-01 | Existe un "costo del caso" con un pagador único | No hay precio por caso. La monetización es por **suscripción** (`planes`/`suscripciones`) |
| C-02 | El arbitraje está implementado y hay que sacarlo del selector | El arbitraje **nunca se implementó**. Sólo existe en el texto de los TyC |
| C-04 | Hay una "tabla de métodos" donde poner `sort_order` | Los métodos son un `ENUM` de Postgres de 3 valores |
| C-06 | El botón de asesoramiento es terreno virgen | Ya hay un **canal de contacto** y un **botón de abogado pago** en las mismas pantallas |

Ninguna de estas cuatro observaciones invalida el pedido de fondo. Lo que cambia es qué hay que preguntar antes de codear, y cuánto cuesta cada cosa.

---

## 1 · Mapa por requerimiento

Dueño = quien abre el ticket y responde por el punto. El resto acompaña. Criterio de `docs/reparto-tyc-devs.md`: un dueño por cosa, y la lógica baja nunca sube.

| # | Título | **Dueño** | Acompañan | Impacto DB | Estado |
|---|---|---|---|---|---|
| C-01 | Pago por ambas partes | **DB** → BE | FE (último, chico) | **Sí** (enum + CHECK) | 🔴 **Bloqueado** — falta definir qué se divide |
| C-02 | Arbitraje fuera de alcance | **DB** (el texto vive en una migración) | FE (mock + gate), BE (aviso) | Sí (texto + versión) | 🟡 Premisa distinta — ver §3.2 |
| C-03 | Texto de negociación | **FE** | — (visto de legales) | — | 🟢 Listo para hacer |
| C-04 | Orden por injerencia | **FE** | — | — | 🟢 **Ya se cumple** — sólo falta deduplicar |
| C-05 | Texto de conciliación | **FE** | — | — | 🟢 Listo para hacer |
| C-06 | Botón de asesoramiento por mail | **FE** | — (Producto decide ubicación) | — | 🟡 Choca con lo existente — ver §3.6 |
| C-07 | Marca / logo | **FE** (assets + `app.json`) | fuera de dev: SAS, INPI, diseño | — | 🔴 Bloqueado por cliente |
| C-08 | Modelo de acuerdo | **BE** | DB (persistencia), FE (consume) | Sí | 🔴 Bloqueado por cliente |

**Fuera del equipo de desarrollo:** redacción legal y decisión sobre el arbitraje (estudio) · alcance del servicio de abogado y ubicación del botón de asesoramiento (Producto) · dirección de mail, nombre de marca y alta de SAS (Administración) · modelo de acuerdo (estudio).

---

## 2 · Lo que se puede hacer ya (una tarde) — **todo FE**

Tres cambios, sin DB, sin backend, sin dependencias entre sí ni con nadie. Es el único bloque del documento que no espera a otro rol.

### C-05 — Texto de conciliación

El texto pedido y el que ya está en la app difieren en tres palabras:

- **Hoy:** "El proceso incorpora orientación para acercar las posiciones."
- **Pedido:** "El proceso incorpora orientación **y propone opciones** para acercar las posiciones."

Un solo valor en `i18n/locales/es-AR.json` → `caseCreation.method.descriptions.conciliacion`, más su par en `en.json`. Ya está en i18n, no hay nada hardcodeado que mover.

### C-03 — Texto de negociación

Misma clave, rama `negociacion`. Se agrega la frase sobre el rol de control formal.

⚠️ **Antes de escribirlo, que el estudio lo confirme contra los propios TyC que redactó.** La frase *"La plataforma velará por que se respeten las formas y las normas de orden público"* afirma un deber de control de la plataforma. Los TyC vigentes van en la dirección contraria y son explícitos al respecto (cláusula H.5.7: la Empresa no administra, no controla plazos ni actuaciones). No estamos diciendo que se contradigan —negociación y arbitraje son cláusulas distintas— pero es exactamente el tipo de frase que después se cita en un reclamo, y quien la revisa tiene que ser quien redactó el resto.

La observación del cliente de que *"velará"* puede cambiar no agrega trabajo: al estar en i18n, es editar un valor y desplegar.

### C-04 — Orden de los métodos

**El orden pedido ya es el que está en producción.** Los cuatro lugares del repo donde se declara la secuencia ya dicen `negociacion → conciliacion → mediacion`:

- [`app/case/create/method.tsx:17`](../mediacion-app/app/case/create/method.tsx) — selector de método
- [`features/cases/components/CaseFilters.tsx:20`](../mediacion-app/features/cases/components/CaseFilters.tsx) — filtros del listado
- [`apps/api/src/casos/casos.service.ts:25`](../apps/api/src/casos/casos.service.ts) — validación (no es orden de presentación)
- `packages/db-types/src/database.types.ts:1785` — generado desde el enum, no se toca a mano

No hay cambio de comportamiento que hacer. Lo que sí corresponde, y es lo que el cliente pide en el fondo, es que el criterio viva en **un** lugar: hoy el array está copiado en dos pantallas y nada impide que la tercera nazca desordenada. Se exporta una constante `METODOS_EN_ORDEN` (con el comentario de *por qué* ese orden: injerencia creciente) y las dos pantallas la consumen.

**Alcance del ticket de FE: sólo los dos primeros archivos.** De los otros dos que aparecen en la búsqueda:

- `casos.service.ts:25` es un array de **validación** de BE, no de presentación. No comparte propósito con la constante de UI y no se toca desde front.
- `database.types.ts` es generado desde el enum: lo regenera DB, nunca se edita a mano.

Dos aclaraciones sobre el pedido tal como está escrito:

- **No hay tabla de métodos.** Son un `ENUM` de Postgres (`metodo_caso`, `supabase/migrations/20260721191644_enums.sql:18`). Crear una tabla ABM para tres valores fijos que nunca cambian agrega una migración, una consulta y un cache para no ganar nada. La constante alcanza.
- **No hay panel admin ni reportes donde aplicar el orden.** `apps/panel/` es hoy un stub con un `package.json` vacío. Cuando exista, que consuma la constante.

---

## 3 · Lo que necesita una definición antes de codear

### 3.1 · C-01 — Pago compartido: no está claro qué se divide

Este es el punto que más trabajo implica y el que menos se puede empezar.

**Lo que hay hoy.** La monetización es por suscripción, no por caso (`docs/PACTUM-monetizacion-spec.md` §1): Particular USD 19.90/mes, Estudio USD 59.90/mes, y un único producto transaccional que es la contratación de abogado. **No existe un "costo del caso".** No hay ninguna columna `caso_id` en todo el módulo `apps/api/src/pagos/`.

**Lo que ya se construyó y se parece.** En la reunión del 07/08 el cliente pidió R-07, "quién paga", y se implementó: al invitar, quien crea el caso elige entre `invitador` e `invitado`. Vive en `invitaciones.pago_a_cargo` (TEXT con CHECK, migración `20260810120000_cambios_reunion_07_08.sql:35`), se elige en `app/case/create/invite.tsx` y se cobra en `app/case/[id]/payment-required.tsx`. Lo que paga el invitado ahí es **su propia suscripción**, no una porción de un precio del caso.

**De ahí la pregunta.** "Pagan ambas partes, 50/50 sobre el costo del caso" admite dos lecturas incompatibles:

- **(a) Cada parte paga su suscripción.** Es un tercer valor de `pago_a_cargo` (`ambos`). Trabajo acotado: ampliar el CHECK, el tipo `PagoACargo`, la tarjeta del selector, y el gate de `payment-required` para que espere a los dos. No hay "50/50" porque no hay un monto que partir: cada uno paga su plan completo.
- **(b) Se introduce un precio por caso y se divide.** Es un modelo de monetización nuevo, que convive con las suscripciones y contradice el spec vigente. Implica la tabla `case_payments` que sugiere el documento —un segundo libro de pagos al lado de `suscripciones` y `facturas`—, precio por caso configurable, y dos órdenes de pago de Mercado Pago por caso.

La diferencia entre (a) y (b) es de semanas y de modelo de negocio, no de implementación. **La decide el cliente/PM, no el equipo.**

**Lo que sí es cierto en las dos lecturas** y conviene ir dejando anotado:

- `estado_caso` necesita un valor nuevo para el intermedio (`pendiente_pago_contraparte`). Es un `ENUM`, así que es migración.
- La contraparte tiene que ver el monto antes de aceptar. Hoy `GET /casos/:id/invitaciones` **no devuelve `pago_a_cargo`** — el frontend lo recuerda localmente y lo documenta como deuda (`services/api/cases.backed-service.ts:69`). Cualquiera de las dos lecturas convierte esa deuda en bloqueante: no se le puede mostrar a alguien cuánto debe pagar con un dato que el backend no manda.
- La política de reembolso, que el propio documento marca como pendiente, es la que define si el estado intermedio es reversible. Sin eso no se puede diseñar el estado.

### 3.2 · C-02 — El arbitraje no está en el producto, está en los TyC

**No hay nada que sacar del selector.** El enum `metodo_caso` es `negociacion | conciliacion | mediacion`. No hay pantalla, ni opción, ni código de arbitraje en ninguna parte de la app o la API.

Por eso **no vamos a agregar `arbitraje` al enum detrás de un feature flag**, que es lo que pide el punto 2 leído al pie de la letra. Sería introducir un valor que nunca existió, más una bandera para apagarlo, para poder "activar sin migración" algo que hoy no tiene ni modelo de datos ni flujo. Cuando el arbitraje entre en alcance va a necesitar su migración igual. Dejar el enum "preparado" no ahorra esa migración, sólo agrega un valor muerto que hay que explicar en cada revisión del esquema.

**Dónde sí está el arbitraje, y es lo que importa:** en los Términos y Condiciones. Las cláusulas H.5.1 a H.6.1 (`supabase/migrations/20260814170000_tyc_legal.sql:480-496`, espejadas en `mediacion-app/mocks/legal-texts.ts`) describen con detalle un servicio de arbitraje ad hoc: acuerdo arbitral por firma electrónica, designación de árbitros, sede, idioma, plazo de laudo, materias excluidas por el art. 1651 CCyC.

Es decir: **los TyC le ofrecen al usuario un método que la plataforma no va a prestar.** Eso es lo que hay que resolver, y es trabajo del estudio, no del equipo.

Dos cosas que necesitamos que definan antes de tocar el texto:

1. Si las cláusulas se **eliminan** o se marcan como no disponibles por ahora.
2. **Los TyC son versionados y tienen gate de reaceptación** (`features/legal/components/ReacceptanceGate.tsx`, `VersionNoticeBanner.tsx`). Modificar el articulado sube la versión y, según cómo esté configurado, le pide a **todos los usuarios activos** que vuelvan a aceptar. Sacar una sección entera no es una edición cosmética. Que el estudio confirme si esto amerita nueva versión con reaceptación o si entra como corrección de erratas.

Lo que sí hacemos sin preguntar: revisar onboarding, "cómo funciona" y landing por menciones a arbitraje. (Búsqueda hecha: hoy no hay ninguna fuera de los TyC.)

### 3.6 · C-06 — El botón de asesoramiento pisa dos cosas que ya existen

Técnicamente es el punto más simple del documento: un `mailto:` con parámetros, tres ubicaciones, una variable de entorno. Se hace en un día. El problema no es técnico.

**Colisión 1 — con el producto pago que el mismo cliente tiene que definir.**

En `features/cases/CaseDetailScreen.tsx:264` ya vive `LawyerRequestButton`: "Necesito un abogado", el escalamiento del spec de monetización §7, ARS 40.000 de pago único por negociación. Está **deshabilitado a propósito**, y el comentario del componente explica por qué: el alcance del servicio —qué incluye, en cuánto responden— lo debe Solmi & Asociados, es la decisión #1 del spec, y está marcada como *bloqueante para publicar* ("no se puede cobrar sin decir qué se entrega").

El punto 6 pide poner, **en esa misma pantalla**, un botón gratis que deriva al mismo estudio. Si los dos salen, el gratis se come al pago antes de que el pago llegue a existir. Y las tres ubicaciones pedidas incluyen las dos donde el botón pago está o iría: detalle del caso y fin de negociación sin acuerdo.

Necesitamos que el cliente diga cómo se relacionan: si el asesoramiento por mail es el paso previo gratuito al servicio pago, si lo reemplaza, o si el servicio pago se cae.

**Colisión 2 — con el canal de contacto que exigió el instructivo legal.**

`app/contacto.tsx` + `POST /legal/contacto` es un canal de contacto real, construido para el punto #23 del instructivo de Golosetti: plazo de respuesta declarado, acuse con código de seguimiento `CON-nnnn` y fecha del servidor. Ese par código/fecha es lo que hace **auditable** el plazo. Se llega desde el footer, desde `/arrepentimiento` y desde **Perfil → Ayuda** — que es la primera ubicación que pide el punto 6.

El botón nuevo, por diseño, no guarda nada: "La app no envía nada ni guarda el contenido". Está bien para una consulta de asesoramiento. **No está bien si un usuario lo usa para un reclamo**, porque ahí se pierde el código de seguimiento y el plazo declarado que el instructivo exige.

Se puede convivir, pero no sin trabajo de copy: en Ayuda los dos accesos tienen que quedar claramente distinguidos —*asesoramiento con el estudio* vs. *reclamo/soporte con plazo de respuesta*— y el botón de asesoramiento no puede parecer el camino para quejarse.

**Propuesta:** construirlo primero **sólo en Ayuda**, con el copy diferenciado. Las otras dos ubicaciones esperan la respuesta sobre el servicio pago.

**Correcciones técnicas al pedido:**

- La variable propuesta se llama `NEXT_PUBLIC_CONTACTO_ASESORAMIENTO_EMAIL`. **Esto es Expo, no Next**: el prefijo que se inlinea en el bundle es `EXPO_PUBLIC_`. Además las envs se leen por una lista explícita en `config/env-source.ts` (Expo reemplaza el literal en build, así que no se puede leer dinámicamente). Va como `EXPO_PUBLIC_CONTACTO_ASESORAMIENTO_EMAIL` y se agrega a ese archivo y a `env.example`.
- **No hay botón de WhatsApp del cual copiar el patrón.** No existe integración de WhatsApp en la app. El único precedente de abrir una app externa es `Linking.openURL` en `features/legal/components/CompanyDetails.tsx:79`.
- La cadena de fallbacks del documento (mailto → Gmail web → copiar dirección) es correcta y necesaria: `Linking.canOpenURL` con `mailto:` no es confiable en web, así que el fallback no se puede decidir preguntando, hay que ofrecerlo.
- **El evento de analytics `asesoramiento_click` no tiene dónde ir: no hay capa de analytics en el proyecto.** Ninguna. O queda fuera de alcance, o es una tarea aparte (elegir proveedor, consentimiento, política de privacidad) que es más grande que el botón.
- Lo de no incluir contenido sensible del caso en el cuerpo está bien y es fácil de sostener: el prellenado se arma sólo con número de caso, método y nombre.

---

## 4 · Dependencias del cliente

Las dos que el documento ya marca como bloqueadas, más lo que agregan.

### C-07 — Marca

Buena noticia: **no hay branding que centralizar, porque no hay branding.** El nombre del producto no aparece en ninguna cadena visible al usuario (`app/`, `config/`, `design-system/`, i18n: cero menciones). `app.json` dice `name: "mediacion-app"`, `scheme: "mediacionapp"`. Lo único a reemplazar son los assets: `assets/images/` (icon, `android-icon-foreground/background/monochrome`, favicon, splash).

Mala noticia, y es la que hay que comunicar: **`app.json` no tiene `android.package` ni `ios.bundleIdentifier`.** Nunca se publicó. El bundle id es prácticamente permanente una vez que la app está en las tiendas —cambiarlo es una app nueva, sin reseñas ni instalaciones—, así que el riesgo que el propio cliente anticipa es exacto: esto bloquea la publicación, no la maqueta.

Y hay un tema anterior: **ya hay dos briefs de logo distintos en circulación.** R-01 del 07/08 pidió "dos personas abrazándose". El spec de monetización §10.2 (25/08) especifica "una familia de 3 personas" en composición triangular. Ahora este documento dice que todo está sujeto a la SAS. Antes de encargar nada hace falta **una** definición. (El spec §10.1 ya había señalado lo del INPI, así que en eso el cliente y el equipo coinciden.)

### C-08 — Modelo de acuerdo

El documento pide "dejar la plantilla armada con el fragmento actual, para que al llegar el modelo definitivo sea un reemplazo de contenido y no un rehacer". **No hay plantilla que armar: hay que construir la capa de documento desde cero.**

Hoy `buildAgreementContent` (`apps/api/src/acuerdos/agreement-content.ts`) guarda un JSON con `propuesta_id`, `contenido`, `fundamentacion`, `modelo_ia` y las respuestas de las partes. `acuerdo-export.ts` lo renderiza como un resumen de puntos por categoría. No hay articulado, ni cláusulas, ni variables, ni nada que se parezca a un documento legal.

Así que C-08 no es "reemplazar contenido": es definir el conjunto de variables, construir el renderizador y recién ahí poder cambiar el texto sin tocar código. Bloquea el cierre del flujo de generación y su integración con firma digital (`apps/api/src/acuerdos/docusign/`).

Se puede empezar sin el modelo definitivo —el conjunto de variables sale de lo que ya tenemos: partes, ítems acordados por categoría, fechas, método, firmantes— pero conviene no hacerlo hasta ver aunque sea la estructura del documento del estudio, para no inventar un esquema de variables que después no encaje.

---

## 5 · Fases, abiertas por rol

Orden de merge de siempre: **DB → Backend → Frontend**. Donde una fase toca los tres, el ticket de front no se abre hasta que la migración esté mergeada.

### Fase 0 — C-05, C-03, C-04 · sólo FE, sin dependencias

- **DB:** —
- **Backend:** —
- **Frontend:** dos valores de i18n en `es-AR.json` + `en.json` (descripciones de conciliación y negociación) y la constante `METODOS_EN_ORDEN` consumida por `method.tsx` y `CaseFilters.tsx`.

Se puede hacer hoy. C-03 se escribe cuando el estudio dé el visto a la redacción; no bloquea a C-05 ni a C-04.

### Fase 1 — C-06 · sólo FE, espera un dato

- **DB:** —
- **Backend:** — (no hay endpoint: el mail sale del cliente de correo del usuario)
- **Frontend:** componente de asesoramiento con la cadena `mailto:` → Gmail web → copiar dirección, claves de i18n, y `EXPO_PUBLIC_CONTACTO_ASESORAMIENTO_EMAIL` en `config/env-source.ts` + `env.example`. Ubicación inicial: sólo Ayuda.

Espera la dirección de mail (Administración) y la decisión de ubicación (Producto). El evento de analytics queda fuera de alcance: no hay capa donde mandarlo.

### Fase 2 — C-02 · DB primero

- **DB:** corrección del articulado en la migración de TyC (`20260814170000_tyc_legal.sql`, cláusulas H.5–H.6) y decisión de si sube versión.
- **Backend:** si sube versión con reaceptación, el aviso de cambio a usuarios activos (punto #15 del instructivo).
- **Frontend:** espejar el texto en `mocks/legal-texts.ts` y verificar el comportamiento de `ReacceptanceGate` / `VersionNoticeBanner` con la versión nueva.

FE no toca el texto legal: vive en una migración y su dueño es DB. Lo que le llega a front es el espejo del mock y el gate.

### Fase 3 — C-01 · la cadena completa

- **DB:** ampliar el CHECK de `invitaciones.pago_a_cargo`, valor nuevo en el enum `estado_caso` para el intermedio, y —sólo en la lectura (b)— la tabla `case_payments`.
- **Backend:** exponer `pago_a_cargo` en `GET /casos/:id/invitaciones` (hoy no lo devuelve), órdenes de pago de Mercado Pago y el webhook que libera el caso con ambos pagos acreditados.
- **Frontend:** tercera opción en el selector de `invite.tsx`, el monto visible antes de aceptar, y el estado de espera en `payment-required.tsx`.

**El trabajo de FE acá es chico y va último.** No se puede empezar antes: mostrar "cuánto te toca pagar" depende de un campo que el backend todavía no manda.

### Fase 4 — C-08 · BE

- **DB:** persistencia de la plantilla y sus versiones, si se decide versionarla.
- **Backend:** dueño. Capa de plantilla con variables sobre `agreement-content.ts` y `acuerdo-export.ts`, más la integración con firma.
- **Frontend:** consume el documento generado. No define el esquema de variables, lo propone si la pantalla necesita algo.

### Fase 5 — C-07 · FE, fuera de dev

- **Frontend:** reemplazo de assets en `assets/images/` y `name` / `scheme` / `android.package` / `ios.bundleIdentifier` en `app.json`.
- Todo lo demás (SAS, INPI, diseño del logo, nombre en tiendas) es de Administración y Producto.

---

## 5.1 · Fronteras a congelar antes de escribir código

Los puntos donde dos roles se tocan, en el formato de `docs/reparto-tyc-devs.md` §05.

| Frontera | Qué se congela | Lo produce | Lo consume |
|---|---|---|---|
| `pago_a_cargo` en la invitación | Que `GET /casos/:id/invitaciones` lo devuelva, y con qué nombre | **BE** (revisa DB) | FE |
| Modalidad de pago | Los valores válidos del CHECK y del enum de estado | **DB** | BE, FE |
| Monto a pagar por la contraparte | Quién lo calcula y en qué unidad viaja | **BE** | FE |
| Variables del acuerdo | El conjunto de campos de la plantilla | **BE** (con el modelo del estudio) | FE |
| Texto legal de los TyC | El articulado y el número de versión | **DB** | FE (mock, gate), BE (aviso) |

La primera es deuda ya documentada en `services/api/cases.backed-service.ts:69`: hoy el front recuerda `pago_a_cargo` localmente porque la API no lo devuelve. Mientras sea un mock, pasa. En cuanto haya que mostrar un monto real, es un dato inventado en el cliente.

---

## 5.2 · Tu carril (FE), en una línea

De los ocho puntos, **cuatro son tuyos**: C-03, C-04, C-05 y C-06. Los tres primeros no dependen de nadie y entran hoy. C-06 entra apenas lleguen la dirección de mail y la decisión de ubicación.

De los otros cuatro: C-02 y C-07 te dan tareas chicas de acompañamiento (espejar el mock, reemplazar assets), C-01 te da un ticket chico que va **al final** de la cadena, y C-08 es de BE — vos consumís.

---

## 6 · Qué preguntarle al cliente

Ordenado por cuánto destraba.

1. **Pago compartido (C-01):** ¿cada parte paga su propia suscripción, o se introduce un precio por caso que se divide? Sin esto no se puede empezar el punto más grande del documento.
2. **Asesoramiento vs. abogado pago (C-06):** ¿el botón gratuito de asesoramiento convive con el servicio de ARS 40.000, lo precede o lo reemplaza? Recordar que el alcance de ese servicio sigue siendo la decisión #1 pendiente del spec de monetización, y que es bloqueante para publicar.
3. **Dirección de mail del estudio (C-06):** único dato que falta para entregar la fase 1.
4. **Arbitraje en los TyC (C-02):** ¿se eliminan las cláusulas H.5–H.6 o se marcan como no disponibles? ¿Amerita nueva versión con reaceptación de todos los usuarios?
5. **Redacción de negociación (C-03):** confirmar que "velará por que se respeten las formas" no tensiona los límites de responsabilidad que fijan los propios TyC.
6. **Logo (C-07):** hay tres definiciones en circulación (dos personas abrazándose / familia de tres / bloqueado por SAS). Cuál vale.
7. **Nombre para las tiendas (C-07):** aunque el registro de marca siga en trámite, hace falta el nombre y el bundle id para poder publicar.
8. **Modelo de acuerdo (C-08):** aunque sea la estructura, para no inventar un esquema de variables que después no encaje.
