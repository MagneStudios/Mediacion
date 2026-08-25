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

### 7.1 · ~~Pendiente de BE~~: falta un endpoint de lectura de suscripciones — **resuelto el 17/08**

> **Entregado.** `GET /suscripciones/vigente` existe (ficha §10) y está consumido: `services/api/billing.{api,backed}-service.ts`. El botón de baja ya no es una demo. Lo que sigue abierto de esa entrega —qué significa `fecha_fin` y qué `estado` puede llegar— está en §10.2 de este doc y pedido en `docs/pedidos-frontend-a-backend.md` §6.
>
> Lo que sigue abajo queda como el registro de por qué apareció el pedido.

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

## 9 · ~~Pendiente de BE~~: exponer la versión programada (punto #16) — **resuelto el 17/08**

> **Entregado.** `GET /legal/documentos/:tipo/programada` existe (ficha §9), devuelve el mismo `LegalDocumentView` que pedimos y responde `404 legal_document_not_found` cuando no hay nada programado — la opción que habíamos marcado como también válida. Consumido desde `VersionNoticeBanner`. El punto #16 queda cerrado de los dos lados; lo que ajustamos después está en §10.2.

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

## 10 · Estado (17/08/2026) — BE entregó los dos endpoints; qué revisamos y qué queda

**Rama:** `feat/frontend-tyc-cierre`, desde `dev@111b8e7`.

Backend cerró los dos pedidos de `docs/pedidos-frontend-a-backend.md` en `3e452c9`, **y en el mismo commit escribió la capa de FE que los consume**: `VersionNoticeBanner`, el cableado de `billing.{api,backed}-service.ts`, `SafeAreaProvider` en `app/_layout.tsx`, el branch de estado en `app/profile/plan/index.tsx` y `utils/format-legal-date.ts`. Los shapes coinciden con lo que pedimos, sin desvíos, y la capa de servicios quedó bien cubierta por tests.

Esta sección es la revisión de FE sobre esa entrega y el plan de lo que queda.

### 10.1 · Verificación de la entrega tal como llegó

Corrido sobre `dev@111b8e7`, antes de tocar nada:

| Chequeo | Resultado |
|---|---|
| `pnpm test` (jest) | 915/915, 103 suites |
| `npx tsc --noEmit` | 4 errores, **todos preexistentes**, ninguno en archivos del commit |
| `npx expo lint` | limpio |
| `npx expo export --platform web` | corre; el HTML prerenderizado sale con contenido |

Dos notas sobre esos números, para que el próximo que los compare no se asuste:

- **`tsc` da 14 errores en un checkout limpio y 4 después de levantar el dev server una vez.** Los 10 de diferencia son errores de tipado de rutas (`/contacto`, `/arrepentimiento`, `/terminos-y-condiciones`, `/politica-de-privacidad`) que produce un `.expo/types/router.d.ts` viejo: es un caché gitignoreado, no código. Si el número no coincide con el del changelog de turno, esto es lo primero que hay que descartar — está anotado en `agents/front/AGENTS.md` §Validation y se resuelve con `rm -rf mediacion-app/.expo/types` más un export.
- `npx biome ci .` en la raíz tira 372 errores sobre 373 archivos, todos de fin de línea CRLF. Es ruido de checkout en Windows, no del commit. La validación de FE es `expo lint`, no biome (ver `agents/front/AGENTS.md` §Validation).

### 10.2 · Lo que corregimos en esta rama

**a · La copy de Mi plan prometía algo que la base no puede sostener.**
`SuscripcionesService.cancelSuscripcion` escribe `new Date().toISOString()` en `fecha_fin`: es **el instante de la cancelación**, no el fin del período pagado, y ninguna tabla guarda ese otro dato. Encima de esa columna, la pantalla decía *"Tu plan sigue vigente hasta el {{date}}. Después de esa fecha no se renueva."* — o sea que quien daba de baja leía, en el acto, "tu plan sigue vigente hasta hoy".

El origen no es una copy mal elegida: **`docs/fichas-legal-backend.md` se contradice a sí misma**. §7 documenta la baja con `fecha_fin` = instante de cancelación, y §10 dice que esa misma columna existe *"para que FE pueda decir hasta cuándo sigue vigente lo ya pagado"*. Implementamos §10 al pie de la letra.

Hasta que BE resuelva (pedido en `pedidos-frontend-a-backend.md` §6.1), la pantalla dice **solo lo que la columna guarda**: `billing.myPlan.notice.cancelled` → *"Diste de baja este plan el {{date}}. No se vuelve a cobrar."* Sin promesa de vigencia.

**b · La lectura no filtra `estado`, y el branch asumía `cancelada`.**
`findVigenteByOwner` *ordena* por estado, no filtra, así que los cuatro valores de `estado_suscripcion` llegan a la pantalla. `vencida` con `fecha_fin` pasada se renderizaba como una baja; `pendiente_pago` —que es el **default de la columna**, o sea lo que va a producir un checkout real— caía en "no tenés plan" e invitaba a contratar de nuevo. Ahora cada estado tiene su propio mensaje (`utils/subscription-notice.ts`, con `never` exhaustivo: un quinto valor del enum rompe `tsc` en vez de dejar la pantalla muda).

**c · El banner anunciaba un solo documento.**
Tomaba `[nearest]` del sort. Con Términos y Privacidad programados **para el mismo día** —la forma normal de una revisión legal— el sort estable dejaba `terms` primero y el cambio de privacidad **no se anunciaba nunca antes de entrar en vigencia**: aparecía recién cuando ya regía, que es exactamente lo que el preaviso de 10 días existe para evitar. Ahora se anuncian todos los programados, más cercano primero, y **el descarte pasa a ser por documento**.

**d · `SafeAreaProvider` sin `initialMetrics`.**
`SafeAreaProvider` renderiza sus hijos solo cuando `insets != null`, y sin métricas sembradas eso arranca en null hasta el primer evento: en nativo el árbol entero, `AuthGate` incluido, no dibuja nada durante el primer frame de cada arranque en frío. Se pasa `initialWindowMetrics` (que en web es `null` por diseño — ahí no cambia nada, verificado contra el HTML exportado).

**e · Tests del branch que se había agregado sin ellos.**
`app/profile/plan/__tests__/index.test.tsx` tenía 6 casos y ninguno con `estado !== 'activa'` — justo lo que el commit de BE agregó, y donde vivían (a) y (b).

**f · La fecha de la baja se mostraba un día adelantada. Esta la encontró el navegador, no los tests.**
`formatLegalDate` formatea **en UTC a propósito**: `valid_from` declara un día de calendario, y en hora local un timestamp de medianoche UTC muestra el día anterior al oeste de Greenwich. `fechaFin` no es eso: es **un instante**, y el día que le corresponde al usuario es el de su propio calendario. Reusar el formateador de documentos legales para el instante invierte el mismo error.

Probado en el navegador: dando de baja a las **22:55 del 17 de agosto** en Buenos Aires, la pantalla decía *"Diste de baja este plan el 18 de agosto de 2026"*. Un día después del hecho, sobre la fecha de un acto con efectos legales (Ley 24.240 art. 10 ter).

Ahora hay dos formateadores en `utils/format-legal-date.ts`, con la distinción documentada ahí: `formatLegalDate` (UTC, para el día declarado de un documento) y `formatEventDate` (local, para el momento en que algo pasó). **Ningún test unitario podía ver esto**: comparaban contra el mismo formateador que estaban probando. El que quedó escrito elige el instante de forma que el día local difiera del UTC de cualquier lado de Greenwich, y se verificó por mutación —forzar UTC en `formatEventDate` lo pone en rojo— porque en una máquina en UTC la distinción no existe y el test pasaría sin probar nada.

### 10.3 · Verificación de esta rama

`pnpm test` 932/932 en 104 suites · `npx tsc --noEmit` los mismos 4 preexistentes, cero nuevos · `npx expo lint` limpio.

Y —a diferencia de todas las fases anteriores, donde la "verificación manual" fue estática— **esto se corrió en un navegador de verdad** (`pnpm web`, 1280×720):

- **Baja punta a punta:** suscribirse → comprobante → volver a Mi plan → dar de baja → confirmar. La pantalla queda con *"Diste de baja este plan el 17 de agosto de 2026. No se vuelve a cobrar."*, sin el badge "Plan actual" y sin el botón de baja. De acá salió el punto (f).
- **El banner, que nunca nadie había visto renderizado.** Con dos versiones programadas **para la misma fecha** inyectadas temporalmente en `mocks/legal.ts` (revertido después, no está en el diff): se dibujan los dos avisos con su fecha y su resumen; descartar uno deja el otro; expandir uno muestra solo su texto; la app sigue visible debajo y no aparece scroll horizontal. Ese es exactamente el caso que antes descartaba uno de los dos en silencio.

Lo que **no** se verificó en runtime: el punto (d) — el frame en blanco del arranque en frío es de nativo, y acá no hay device ni simulador. El razonamiento está en el código (`SafeAreaProvider` no dibuja hijos con `insets` en null) y en web el cambio es un no-op comprobado, pero el tilde "flujo completo probado desde el celular" del checklist sigue necesitando un celular.

### 10.4 · El punto #24 no está cerrado, y lo teníamos anotado como cerrado

Repasando el checklist entero —no solo lo que tocó esta entrega— apareció que **el punto #24 del instructivo no se cumple**, y que `docs/pedidos-frontend-a-backend.md` §5 lo daba por "Cerrado" desde el 16/08. Esto no lo introdujo el commit de BE; es anterior y se nos pasó a nosotros.

El instructivo pide *"precios en pesos, finales, con impuestos incluidos"*. Hoy:

- **Todo precio de la app se renderiza en dólares.** `utils/format-plan-limit.ts` hace `new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })`, hardcodeado. Se ve en las tarjetas de plan, en el desglose del checkout y en el ABM de admin: "US$ 9,99", "US$ 25,00". Verificado en el navegador.
- **Sobre ese precio en dólares se calcula IVA argentino del 21%.** `mocks/tax-config.ts` refleja el seed real `{"AR":{"iva":21,"otros_impuestos":0}}`. En el checkout: neto US$ 9,99, IVA US$ 2,10, total US$ 12,09. Un precio en dólares con IVA argentino encima es una de las dos cosas mal, y las dos son visibles para el usuario.
- **No hay moneda en ninguna parte del esquema.** `planes.precio` es `numeric(10,2)` con la nota "Precio neto, sin impuestos (R-09)" y ninguna columna de moneda, ni en `mediacion.dbml` ni en la migración. El seed real es `25.00` para estudio. Así que el `'USD'` del front no está reflejando un dato: lo está inventando.
- **El precio listado no es final.** Las tarjetas del catálogo muestran el neto; el total con impuestos aparece recién en el checkout. El instructivo pide que el precio que se muestra sea el final.

**Esto no lo arreglamos por nuestra cuenta y no es solo nuestro.** Cambiar `'USD'` por `'ARS'` es una línea, pero los valores sembrados (9,99 / 19,99 / 25,00) son puntos de precio de dólar: releerlos como pesos sería peor que el bug. El reparto asigna el #24 a **DB (fuente) → BE (cálculo) → FE (muestra)**, y lo que falta primero es la fuente: en qué moneda están esos números y si el catálogo debe listar el precio final. Eso es Producto + DB.

Lo que sí es nuestro sin ambigüedad, el día que se decida: sacar el `'USD'` hardcodeado y mostrar el total con impuestos en la tarjeta, no solo en el checkout.

> **Corregido el 23/08** (rama `story/punto-24-precios-moneda`): la columna `planes.moneda` ya existe (`20260823120000_planes_moneda.sql`, default `'ARS'`, CHECK `planes_moneda_check`), el `'USD'` hardcodeado de `format-plan-limit.ts` se eliminó — `formatPlanPrice(precio, moneda)` formatea con el dato — y las tarjetas del catálogo muestran el precio **final** con impuestos, con el neto como dato secundario. Lo único que sigue abierto de esta sección es si los valores sembrados se resiembran (Producto) — ver §10.5 y `pedidos-frontend-a-backend.md` §7.

### 10.5 · Lo que queda abierto, y de quién es

| Qué | De quién | Dónde está |
|---|---|---|
| **Punto #24: mecánica cerrada el 23/08** (`planes.moneda` fuente + `currency_id` desde el dato + catálogo con precio final e impuestos incluidos); lo que queda abierto es **si los valores sembrados (9,99/19,99/25,00) se resiembran** — parecen price points de dólar | **Producto** (los valores; la mecánica ya no espera a nadie) | §10.4 + `pedidos-frontend-a-backend.md` §7 (respuesta del 23/08) |
| Punto #4: flujo completo probado desde un celular real | **FE**, necesita device | §10.3 |
| Qué significa `fecha_fin` — exponer el fin del período pagado o corregir la ficha §10 | **BE + Producto** | `pedidos-frontend-a-backend.md` §6.1 |
| Declarar el dominio de `estado` en la ficha §10, y decidir si el endpoint filtra | **BE** | `pedidos-frontend-a-backend.md` §6.2 |
| §1 de la ficha quedó con la definición vieja de "vigente" (`valid_to IS NULL`) | **BE**, corrección de texto | `pedidos-frontend-a-backend.md` §6.3 |
| Seed de `legal_documents` v1.0 — 42 campos `[COMPLETAR]` | **Administración** | sin cambios |
| Criterio escrito de "cambio sustancial" | **Producto + legales** | sin cambios |
| Baja verificada en el panel de la pasarela (migrar a `preapproval`) | **Producto + BE** | sin cambios |

Y tres decisiones de FE que dejamos anotadas sin tomar, porque ninguna es un defecto:

- **El banner no tiene ventana.** `LEGAL_AVISO_DIAS_ANTICIPACION` (default 10) acota el **email**, no la lectura de `/programada`, que devuelve cualquier `valid_from > now`. Una versión programada con 60 días de anticipación produce 60 días de aviso in-product, y como el descarte es por sesión, vuelve en cada arranque. Más aviso no es ilegal; es una decisión de UI que hoy nadie tomó.
- **El checkout sigue en mock mientras "Mi plan" lee la API.** Con backend configurado, alguien contrata en el checkout demo, ve el recibo, y al volver a Mi plan lee "no tenés plan". Antes el mock mentía de forma consistente; ahora miente de forma inconsistente. Vale decidir si el checkout dice en voz alta que es demo o si se saca. No hay endpoint de factura y `POST /suscripciones/:id/pago` devuelve un `init_point`, no un pago confirmado. **Registrado el 23/08: la mitad "que lo diga en voz alta" ya estaba resuelta** — `billing.checkout.sandboxNotice` ("Este es un entorno de prueba: no se realiza ningún cobro real.") se muestra en `app/profile/plan/checkout.tsx`; sacarlo o cablearlo de verdad sigue siendo decisión de Producto.
- **`billing.myPlan.cancel.dialogBody`** decía *"Vas a poder usar la aplicación hasta el final del período que ya pagaste"* — la misma promesa que sacamos de la pantalla, en el diálogo de confirmación. **Cerrado el 23/08** (rama `story/punto-24-precios-moneda`): BE ya había decidido (18/08, §6.1 del doc de pedidos) que `fecha_fin` es el instante de la baja, así que la promesa no tenía dato que la sostuviera. La copy nueva (es-AR + en) se alinea con `billing.myPlan.notice.cancelled`: se cancela el cobro recurrente, no se vuelve a cobrar, la cuenta y los casos no se borran — sin prometer vigencia posterior. Con test de regresión que abre el diálogo y asserta la ausencia de la promesa (`app/profile/plan/__tests__/index.test.tsx`).

Y un defecto chico, preexistente, que apareció mirando el checkout en el navegador y que **no** tocamos por estar fuera del alcance de esta rama: el header de `app/profile/plan/checkout.tsx` muestra literalmente **"Suscribirte al plan {{nombre}}"**. `<Stack.Screen options={{ title: t('billing.checkout.title') }} />` pasa la clave sin el interpolado, mientras el `<Text>` del cuerpo sí lo pasa. Es una línea; va en la próxima que toque esa pantalla, o antes si Producto decide qué pasa con el checkout demo.

> **Corregido el 23/08** (rama `story/punto-24-precios-moneda`, "la próxima que toque esa pantalla" fue esta): el título con plan cargado interpola `{ nombre }`, y los estados de loading/error usan la clave nueva `billing.checkout.screenTitle` ("Suscripción"), que no tiene placeholder — el literal `{{nombre}}` ya no puede renderizarse en ningún estado, y hay test de regresión (`checkout.test.tsx`).

### 10.6 · Una nota de proceso

BE editó 20 archivos de `mediacion-app/`. Su propio `agents/back/AGENTS.md` lo prohíbe en dos lugares (§Stack: *"`mediacion-app` (Expo frontend — read-only for backend agents)"*; §Repository boundaries: *"`mediacion-app/`, `agents/front/`, root config are read-only — inspect freely, never edit"*), y el reparto asigna #16 y #19 a FE. El código está bien hecho y bien comentado; lo que se salteó fue la revisión de FE sobre copy y estados de pantalla, que es de donde salieron (a), (b), (c) y (e). No es una queja retroactiva: es el argumento de por qué la regla existe.

---

*Dudas o cambios al contrato: responder sobre este doc o en el PR de la rama.*
