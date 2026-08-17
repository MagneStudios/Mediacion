# Módulo legal (TyC) — contrato FE ↔ DB/BE

**Fecha:** 14/08/2026
**Rama:** `feat/frontend-tyc-aceptacion` (desde `dev@4d42fe3`, post PR #100)
**Autor:** Frontend
**Fuentes:** `docs/Instructivo_Implementacion_TyC_-_Golosetti_Abogados.md` · `docs/reparto-tyc-devs.md` (anexo de reparto) · `docs/TYC_Metodos_autocompositivos.md` · `docs/metodos_privacidad_raw.md`

---

## 0 · Para qué es este documento

Frontend ya construyó **toda su capa del instructivo de TyC** contra mocks, siguiendo el patrón `plans.service` del repo. Este documento es la ficha de lo que **DB y Backend tienen que construir** para que eso se conecte, con los shapes exactos que FE ya consume. Es el "contrato congelado" del §05 del anexo: una vez acordado, renombrar una columna o un campo pide PR propio y aviso explícito.

**Importante:** nada de lo de FE es la garantía legal. El checkbox es cortesía de UI; la prueba es el registro que escribe el servidor y la garantía es el constraint en Postgres (§00 del anexo). Hasta que DB y BE entreguen lo suyo, la plataforma sigue **sin prueba de aceptación real** — hoy un usuario se registra y contrata sin dejar registro. Eso es lo que este trabajo cierra entre los tres roles.

---

## 1 · Qué hay hecho en la rama (para probar)

```bash
git fetch && git switch feat/frontend-tyc-aceptacion
cd mediacion-app && pnpm install && pnpm web
```

| Qué | Dónde | Punto del instructivo |
|---|---|---|
| Páginas públicas `/terminos-y-condiciones` y `/politica-de-privacidad`, renderizadas desde datos, fecha de última actualización desde `valid_from` | `app/terminos-y-condiciones.tsx`, `features/legal/components/LegalDocumentScreen.tsx` | #1, #4, #5 |
| Rutas legales accesibles sin sesión | `features/auth/AuthGate.tsx` | #1, #17 |
| Checkbox del design system (imposible pre-tildarlo) + casillas separadas TyC+Privacidad / marketing en **signup y checkout**, submit bloqueado sin la obligatoria | `design-system/components/Checkbox.tsx`, `features/legal/components/AcceptanceCheckboxes.tsx` | #6, #7, #8 |
| Re-aceptación bloqueante para cambio sustancial (falla abierto) | `features/legal/components/ReacceptanceGate.tsx` | #16 |
| `/arrepentimiento` pública + botón en el login + datos de empresa + Ventanilla Única | `app/arrepentimiento.tsx`, `features/legal/components/CompanyDetails.tsx` | #17, #21, #22 |
| Baja de suscripción online en Mi plan | `app/profile/plan/index.tsx`, `billing.service.cancelSubscription` | #19 |
| Footer legal en todas las páginas (shell desktop + pantallas de auth) | `features/legal/components/LegalFooter.tsx` | #2 |
| Textos reales de Golosetti como mock, `[COMPLETAR]` visibles | `mocks/legal-texts.ts`, `mocks/legal.ts` | #10 (provisorio) |
| 30 tests: casilla nunca pre-tildada, marketing no bloquea, payload sin IP/UA/versión, fecha desde el dato, estados, gate | `app/__tests__/signup.test.tsx`, `app/profile/plan/__tests__/checkout.test.tsx`, `features/legal/**/__tests__`, `services/**/__tests__/legal*` | — |

Todo corre contra `services/legal.service.ts` (mock). El cliente API real ya está escrito y registrado en `services/api/legal.api-service.ts` + `services/api/backend.ts`, **sin activar**: la activación es cambiar el singleton de `legal.service.ts` cuando los endpoints existan, sin tocar ninguna pantalla.

---

## 2 · Lo que FE necesita de DB

Dueño según el anexo: §02. Lo que sigue es lo que las pantallas ya asumen.

### 2.1 `legal_documents` (punto #10)

Columnas que FE consume (los nombres viajan por la API en snake_case):

| Columna | Tipo esperado | Uso en FE |
|---|---|---|
| `tipo` | `'terms' \| 'privacy'` | selector de página |
| `version` | `TEXT` (`v1.0`, `v1.1`, `v2.0`) | badge visible |
| `contenido` | `TEXT` — texto completo congelado | cuerpo de la página; **no** vive en el repo del front |
| `valid_from` | `TIMESTAMPTZ` | **la fecha de "última actualización" visible sale de acá** |
| `valid_to` | `TIMESTAMPTZ NULL` | `NULL` = versión vigente |
| `is_substantial` | `BOOLEAN` | dispara la re-aceptación bloqueante |
| `resumen_cambios` | `TEXT NULL` | el "qué cambió" en lenguaje llano que muestra el gate |

Formato de `contenido` que el renderer parsea (`LegalDocumentBody`): líneas `## X. TÍTULO` = encabezado de sección, todo lo demás = párrafo. `mocks/legal-texts.ts` tiene los dos documentos ya normalizados a ese formato — sirve tal cual como contenido del seed.

**Seed v1.0 bloqueado por Administración:** los textos tienen 42 campos `[COMPLETAR]` (razón social, CUIT, domicilio, casillas de contacto, N° de registro AAIP, plazos). FE los muestra a propósito; no publicar la versión hasta tenerlos.

### 2.2 `user_agreements` (puntos #9, #11, #13)

FE nunca lee ni escribe esta tabla directamente — todo pasa por BE — pero el flujo asume lo que el anexo ya exige:

- Un registro por aceptación y **por tipo** (`terms` / `privacy` / `marketing`); marketing con `accepted = false` también se guarda.
- Append-only real: sin `UPDATE`/`DELETE` para ningún rol, RLS + trigger.
- Sin `ON DELETE CASCADE` desde `usuarios` (retención 5 años). Ojo con el flujo R-06 de anonimización ya mergeado: la depuración **no** debe tocar estas filas.
- **El constraint que rechaza contratar sin aceptación vigente.** FE registra la aceptación *antes* de llamar al alta de suscripción (ver `checkout.tsx:handlePay`) justamente para que el insert de `suscripciones` pase el constraint. Si el orden les resulta distinto, avisar: es un cambio de contrato.

---

## 3 · Lo que FE necesita de BE

Cuatro endpoints. Los shapes de request/response son **exactamente** los que `services/api/legal.api-service.ts` ya implementa — están testeados en `services/api/__tests__/legal.api-service.test.ts`.

### 3.1 `GET /legal/documentos/:tipo`

- `:tipo` ∈ `terms` | `privacy`. Público (la página se ve sin sesión).
- Devuelve la versión vigente:

```json
{
  "tipo": "terms",
  "version": "v1.0",
  "contenido": "…texto completo…",
  "valid_from": "2026-08-13T00:00:00Z",
  "valid_to": null,
  "is_substantial": false,
  "resumen_cambios": null
}
```

### 3.2 `POST /legal/aceptaciones` — ⚠️ acá vive el punto #12 reasignado

- Autenticado. Body **completo**:

```json
{ "marketing": true }
```

- `marketing` es **opcional**: cuando falta (re-aceptación de una versión nueva), no se escribe fila de marketing — la elección hecha en el registro no se pisa.
- **Todo lo demás lo resuelve el servidor**: IP desde `x-forwarded-for`, user agent del header, timestamp con zona, y la versión vigente consultando `legal_documents`. El anexo asignaba esta captura a "FE (Server Action)", pero este stack no es Next.js — `mediacion-app` es Expo exportado estático y el servidor es NestJS. Si FE mandara IP/UA/versión en el body sería el **error #3 del instructivo**: prueba falsificable, no sirve. Hay un test de FE que rompe si alguien agrega esos campos al payload.
- Respuesta: `204` o `200` sin body (FE la ignora).

### 3.3 `GET /legal/aceptaciones/vigente`

- Autenticado. Qué le falta aceptar al usuario de la versión vigente:

```json
{ "pendientes": ["terms"], "requiere_reaceptacion": true }
```

- `requiere_reaceptacion = true` solo si alguna pendiente es `is_substantial` — es lo que hace bloquear al `ReacceptanceGate`. FE **falla abierto** si este endpoint no responde: la app no se brickea, el constraint de DB sigue siendo la garantía.

### 3.4 `POST /legal/arrepentimiento`

- **Público, sin sesión** (Res. 424/2020; punto #18 del anexo). Body:

```json
{ "nombre": "Ana Pérez", "email": "ana@example.com", "detalle": "Plan estudio, contratado el 10/08" }
```

- Respuesta:

```json
{ "id": "arr-0001", "received_at": "2026-08-14T15:02:00Z" }
```

- El `id` es el número de seguimiento que se le muestra al usuario. BE además registra, notifica a Operaciones y deja traza (eso no pasa por FE). Al ser público, considerar rate-limiting.

### 3.5 Ya consumido por FE con mock, para más adelante

- **Baja de suscripción** (punto #20): FE ya tiene el botón y el diálogo llamando a `billingService.cancelSubscription()`. Cuando exista el endpoint real de cancelación en Mercado Pago (hoy `suscripciones.controller.ts` solo tiene `@Post()`), definimos la ficha y se conecta igual que el resto.
- Export CSV/PDF del log (#14) y aviso de cambio de versión a 10 días idempotente (#15): sin dependencia de FE salvo que el aviso in-product (#16) va a leer `resumen_cambios`.

---

## 4 · Cómo se activa en FE cuando publiquen

1. BE publica la ficha de cada función (como pide §06 del anexo) y confirma que coincide con §3 de este doc.
2. FE cambia el singleton de `services/legal.service.ts` de mock a backed (un archivo; las pantallas no se tocan).
3. DB seedea `legal_documents` v1.0 con los datos de Administración ya completos → la fecha visible y los textos cambian solos, sin deploy del front.

Cualquier desvío del shape (nombre de campo, tipo, semántica de `marketing` ausente) **avisar antes de implementar** — es más barato ajustar el contrato que descubrirlo integrando.

---

## 5 · Bloqueos que no son de desarrollo

| Qué | Quién | Bloquea |
|---|---|---|
| Razón social, CUIT, domicilio, casillas de contacto, N° registro AAIP, plazos de conservación | **Administración** | Seed v1.0 publicable; `CompanyDetails` muestra "Dato pendiente de publicación" hasta entonces |
| Criterio escrito de "cambio sustancial" | **Producto + legales** | Cuándo marcar `is_substantial = true` |
| Definición de plazos `[COMPLETAR]` internos del texto (vigencia invitación = 72 h por R-04, conservación de evidencia, etc.) | **Producto + legales** | Texto final de v1.0 |

---

---

## 6 · Estado (15/08/2026) — BE publicó su ficha

- **DB:** entregado. `supabase/migrations/20260814170000_tyc_legal.sql` en `dev`.
- **FE:** mergeado en `dev`, todavía sobre el singleton mock.
- **BE:** implementado en `story/tyc-legal-backend`. La ficha de cada función está en `docs/fichas-legal-backend.md` y **coincide con §3 de este documento sin ningún desvío**: mismos paths, mismos nombres de campo, misma semántica de `marketing` ausente. El único agregado es `POST /legal/contacto` (punto #23), que FE todavía no consume.
- Los dos endpoints de §3.5 ya existen: la baja es `POST /suscripciones/:id/baja` (devuelve `{ id, estado, fecha_fin }`) y el export del log es `GET /legal/aceptaciones/export` (CSV, solo `admin`).
- **Lo que falta para activar:** cambiar el singleton de `services/legal.service.ts` a la implementación backed. Ninguna pantalla se toca.

---

## 7 · Estado (16/08/2026) — FE activado

Revisado el entregable de DB (`20260814170000_tyc_legal.sql` + decisiones del 14/08) y de BE (`docs/fichas-legal-backend.md`): **coinciden con §2 y §3 sin desvíos**. Dos cosas quedaron mejor que lo pedido y conviene dejarlas asentadas:

- El append-only se garantiza con **trigger**, no solo con RLS. El razonamiento de DB es correcto y no estaba explícito en este doc: `service_role` tiene `bypassrls = true`, así que la RLS sola no lo cubre.
- BE **rechaza con `400` cualquier clave extra** en el body de `POST /legal/aceptaciones`. Este doc solo pedía "el body lleva únicamente marketing"; ahora es una defensa activa del lado del servidor. El error #3 del instructivo queda cerrado por los dos lados.

**FE activado** en `feat/frontend-tyc-activacion`: el singleton de `services/legal.service.ts` resuelve al backend cuando hay uno configurado. Ninguna pantalla cambió. Detalles de la integración:

- `404 legal_document_not_found` se mapea a `undefined` → la página muestra el estado vacío ("todavía no está publicado"), no un error. Cualquier otro fallo sigue propagando con reintento.
- El payload de aceptación **omite** la clave `marketing` cuando no vino (re-aceptación), en vez de mandarla como `undefined`: la validación del API lee el conjunto de claves.
- `getCompanyInfo` no tiene endpoint en ningún lado y se resuelve local con el registro en nulls. La UI dice "Dato pendiente de publicación" hasta que Administración entregue.

### 7.1 · Pendiente de BE: falta un endpoint de lectura de suscripciones

> Especificado para implementar en **`docs/pedidos-frontend-a-backend.md`** §2.

`POST /suscripciones/:id/baja` está implementado y su ficha es clara, pero **FE todavía no lo puede consumir**. El inventario de billing en `apps/api` es:

| Ruta | Estado |
|---|---|
| `GET /planes` | existe |
| `POST /suscripciones` | existe |
| `POST /suscripciones/:id/baja` | existe |
| `POST /suscripciones/:id/pago` | existe |
| **lectura de la suscripción vigente** | **no existe** |

La pantalla "Mi plan" (`app/profile/plan/index.tsx`) decide si muestra el botón de baja —y de dónde saca el `:id`— a partir de `billingService.getCurrentSubscription()`, que hoy es mock puro: el id que devuelve es sintético (`generateMockSubscriptionId`). Llamar a `POST /suscripciones/<id-mock>/baja` daría `404 suscripcion_not_found`.

**Lo que hace falta:** un `GET /suscripciones/vigente` (o `GET /me/suscripcion`) que devuelva la suscripción activa del caller — como mínimo `id`, `plan_id`, `estado`, `fecha_inicio`, `fecha_fin`, o `null` si no tiene. Con eso, conectar la baja real es un cambio chico y contenido en la capa de servicios.

Mientras tanto el botón de baja queda contra el mock: el flujo de UI está construido y probado punta a punta, y no se cablea a la API hasta que exista la lectura — un botón que siempre devuelve 404 es peor que uno declaradamente simulado.

### 7.2 · Superficie de BE que FE todavía no consume

- `GET /legal/aceptaciones/export`: admin-only, entregable de BE. FE no lo necesita salvo que Producto quiera una pantalla de administración.

---

## 8 · Canal de contacto (punto #23) — cerrado

`POST /legal/contacto` está consumido desde `app/contacto.tsx` (rama `feat/frontend-legal-contacto`). Con esto el punto #23 del instructivo, que el reparto asignaba a **BE + FE**, queda completo de los dos lados.

- **Ruta pública** `/contacto`, en la allowlist de `AuthGate`: el requisito es un canal que alguien pueda alcanzar, y quien tiene un reclamo puede no tener cuenta o haberla cerrado.
- **Plazo de respuesta declarado arriba del formulario**, leído de `CompanyInfo.plazoRespuestaDias`. Va antes de los campos y no debajo: una promesa que el usuario recién lee después de escribir no es una declaración.
- **Acuse con el código `CON-nnnn` y la fecha del servidor.** Ese par es lo que hace auditable el plazo — la fecha de ingreso que BE registra es exactamente lo que sostiene el compromiso.
- Alcanzable desde el footer de todas las páginas, desde la tarjeta de datos de empresa en `/arrepentimiento`, y desde Perfil → Ayuda. Ese último botón mostraba un aviso de demo que decía que **no** había canal de contacto; ahora abre el formulario real.

**Nota sobre el mock:** los códigos de seguimiento del mock pasaron de `arr-0001` a `ARR-0001`/`CON-0001`, con secuencias separadas, para no divergir de los triggers de DB. Un código con otra forma en la demo que en producción es una diferencia que solo se descubre cuando alguien lo cita en un reclamo.

---

## 9 · Pendiente de BE: exponer la versión programada (punto #16)

> Los dos pedidos abiertos a Backend —este y el de §7.1— están especificados, con shapes listos para implementar, en **`docs/pedidos-frontend-a-backend.md`**. Esta sección queda como el registro de por qué apareció.

Repasando `docs/fichas-legal-backend.md` y `agents/back/AGENTS.md` apareció una mitad del punto #16 que no está construida y **hoy no se puede construir**.

El reparto asigna a FE el punto 16 completo: *"**Aviso in-product** + re-aceptación bloqueante si el cambio es sustancial"*, y §05 lo repite en la tabla de fronteras (*"Publicación de versión → DB → BE → FE (banner)"*). El instructivo §4.8 pide avisar los cambios *"por email a todos los usuarios activos **y con un aviso dentro del producto**"*.

FE tiene la re-aceptación bloqueante, que actúa **cuando la versión ya entró en vigencia**. Falta el banner de los 10 días previos, y no hay forma de alimentarlo: `LegalRepository.findVigente` filtra `valid_from <= now`, así que `GET /legal/documentos/:tipo` nunca devuelve una versión programada. BE tiene el dato — el tipo `PublicacionProgramada` existe y `legal-avisos.scheduler.ts` lo consulta — pero ninguna ruta lo expone.

**Lo que haría falta:** `GET /legal/documentos/:tipo/programada` (o un flag en el endpoint actual) que devuelva, si existe, la versión con `valid_from > now`:

```json
{ "tipo": "terms", "version": "v2.0", "valid_from": "2026-09-01T00:00:00Z", "is_substantial": true, "resumen_cambios": "Cambió cómo se cobra el servicio." }
```

Con eso el banner es trabajo chico de FE: leer la versión programada, mostrar desde cuándo rige y el resumen, y desaparecer solo cuando `valid_from` pasa y toma el relevo la re-aceptación bloqueante que ya existe.

### 9.1 · Lo que sí se corrigió de ese repaso (ya en la rama)

- **`429 too_many_requests`** tiene ahora su propio estado en los dos formularios públicos, sin botón de reintento: dentro de la ventana el reintento falla igual, y en un canal de reclamos un botón que no funciona se lee como un sistema roto. Estaba documentado en las fichas §4 y §8 y se nos había pasado.
- **La definición de "vigente" del mock** se alineó con `findVigente` (`valid_from <= now AND (valid_to IS NULL OR valid_to > now)`). Solo filtraba `valid_to`, así que con una publicación programada —justo lo que produce el flujo de aviso a 10 días— habría mostrado el texto nuevo antes de tiempo.
- **`valid_from` y `received_at` pasaron a nullable** en los tipos de FE, para coincidir con `normalizeTimestamp`. Las columnas son `NOT NULL`, pero si alguna vez llegara null se veía "1 de enero de 1970" en la página legal y en el acuse.

### 9.2 · Dos notas operativas (no son de FE)

- **`OPERACIONES_EMAIL` vacío hace que el aviso se loguee en vez de enviarse** (`agents/back/AGENTS.md` §Config). Los formularios de arrepentimiento y contacto registran la fila igual, pero nadie se entera. El instructivo §5 pide "alguien que efectivamente responda el canal de contacto": conviene que esa variable esté en el checklist de despliegue.
- **La baja en la pasarela hoy es un no-op**: `HttpMercadoPagoClient.cancelSubscription` busca el preapproval por `external_reference` y no hace nada si no existe, porque las suscripciones se cobran como preferencias one-off. El checklist del anexo pide la baja "verificada en el panel de la pasarela" — ese tilde todavía no se puede poner.

---

*Dudas o cambios al contrato: responder sobre este doc o en el PR de la rama.*
