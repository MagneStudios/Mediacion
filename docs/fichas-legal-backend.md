# Fichas de función — módulo legal BE

**Fecha:** 15/08/2026, ampliada el 17/08/2026 · **Rama:** `story/tyc-legal-backend`, después `story/tyc-cierre-pendientes` · **Autor:** Backend

La ficha que exige §06 del anexo de reparto, una por función. Es el handshake que FE necesita antes de cambiar el singleton de `services/legal.service.ts` de mock a backed. Los shapes de §1 a §4 son los que `mediacion-app/services/api/legal.api-service.ts` ya implementa y testea: **están congelados**. Los de §5 a §8 los define BE acá.

Los de §9 y §10 son los dos pedidos de `docs/pedidos-frontend-a-backend.md`, implementados el 17/08. Los de §11 y §12 son §3.1 y §3.2 de `docs/pedidos-frontend-monetizacion.md`, implementados el 03/09.

Error envelope global: `{ "error": { "code", "message", ...detalle } }` (`common/filters/all-exceptions.filter.ts`; desde el 03/09 los campos adicionales del body de una `HttpException` viajan dentro de `error`, ver §12). Códigos nuevos de este módulo: `legal_document_not_found`, `too_many_requests`, `suscripcion_not_found`, `invalid_cron_authorization` (reusado), `quota_exceeded`.

**Contratar sin aceptación vigente responde `409 conflict`** (desde el 17/08). El trigger `validate_suscripcion_aceptacion` levanta `P0001`, que `toDomainError` mapea; antes levantaba `22000`, que no está mapeado, y el rechazo salía como `500 internal_error`. Cubre las dos ramas: la personal y la de estudio. El trigger también corre en `UPDATE OF usuario_id, estudio_id` — antes era solo `BEFORE INSERT`, así que reasignar la titularidad de una suscripción existente esquivaba la regla.

**`has_accepted_current` mide vigencia real desde el 17/08** (`20260817140000`). Definía "la versión actual" como `valid_to IS NULL`, mientras el resto del sistema usa `valid_from <= now AND (valid_to IS NULL OR valid_to > now)`. Las dos coincidían solo mientras hubiera una fila por tipo. Dejaban de coincidir al programar una publicación — lo que el instructivo §4.8 obliga a hacer con 10 días de anticipación, y para lo que existe el endpoint §9: el índice parcial `legal_documents_tipo_vigente_unique` admite una sola fila con `valid_to` nulo por tipo, así que programar una v2.0 obliga a cerrar la v1.0 y `valid_to IS NULL` pasa a apuntar a la versión futura. Efecto medido sobre una base real: `has_accepted_current` se volvía `false` para todos, el trigger rechazaba **toda** alta de suscripción durante los 10 días, y aceptar no lo arreglaba porque `POST /legal/aceptaciones` escribe la versión que rige. O sea que cumplir con el preaviso legal cerraba la contratación de la plataforma.

---

## 1 · `GET /legal/documentos/:tipo`

| | |
|---|---|
| Auth | `@Public()` — la página legal se ve sin sesión |
| Módulo | `apps/api/src/legal/legal.controller.ts` |

- `:tipo` ∈ `terms` \| `privacy`. Cualquier otro valor → `400 invalid_input`.
- Devuelve la fila de `legal_documents` con ese `tipo` **en vigencia ahora**: `valid_from <= now AND (valid_to IS NULL OR valid_to > now)`. **No `valid_to IS NULL` sola** — esa es la definición que rompió `has_accepted_current` (ver la nota del 17/08 más arriba) y que `agents/back/AGENTS.md` ahora prohíbe.

```json
{
  "tipo": "terms",
  "version": "v1.0",
  "contenido": "…texto completo…",
  "valid_from": "2026-08-14T17:00:00.000Z",
  "valid_to": null,
  "is_substantial": false,
  "resumen_cambios": null
}
```

- Sin versión vigente para un tipo válido → `404 legal_document_not_found`.
- `valid_from` y `valid_to` salen por `normalizeTimestamp`: el driver devuelve `Date`, no `string`.
- "Vigente" para BE es **la versión en vigencia ahora**: `valid_from <= now AND (valid_to IS NULL OR valid_to > now)`. Con el dato de hoy (una sola fila por tipo, `valid_from` = fecha de la migración, `valid_to` nulo) el resultado es el mismo que filtrar solo por `valid_to IS NULL`; la diferencia aparece recién cuando se programe una publicación futura, y evita que la página muestre el texto nuevo diez días antes de que entre en vigencia.

---

## 2 · `POST /legal/aceptaciones`

| | |
|---|---|
| Auth | Bearer (guard global) |
| Respuesta | `204 No Content` |

Body admitido — **solo** esto:

```json
{ "marketing": true }
```

- `marketing` es opcional y booleano. Ausente = no se escribe fila de marketing (re-aceptación: no se pisa la elección del registro).
- Cualquier propiedad extra en el body → `400 invalid_input`. Es la defensa contra el error #3 del instructivo: si el cliente pudiera mandar `ip`, `user_agent`, `document_version` o `accepted_at`, la prueba sería falsificable. La lista negra explícita de esos cuatro nombres se testea.
- El servidor resuelve, por cada `INSERT`:
  - `user_id` ← `@CurrentUser().id`
  - `document_version` ← `legal_documents.version` de la fila vigente de ese `tipo`
  - `ip` ← primer valor de `x-forwarded-for`, fallback `request.ip`. La columna es `INET`: un valor no parseable es `400 invalid_input`, nunca una fila con IP inventada.
  - `user_agent` ← header `user-agent`, string vacío si falta
  - `accepted_at` ← default de la base
- Escribe **una fila por tipo**, en una transacción: `terms` y `privacy` con `accepted = true`, y `marketing` con el booleano recibido cuando vino.
- Si falta la versión vigente de `terms` o de `privacy` → `404 legal_document_not_found`, sin escribir nada.

---

## 3 · `GET /legal/aceptaciones/vigente`

| | |
|---|---|
| Auth | Bearer |

```json
{ "pendientes": ["terms"], "requiere_reaceptacion": true }
```

- `pendientes` ⊆ `["terms", "privacy"]`: los tipos cuya versión vigente el usuario **no** aceptó, resuelto con `has_accepted_current(user_id, tipo)` (rol de servidor).
- `requiere_reaceptacion` es `true` solo si alguno de los pendientes tiene `is_substantial = true`.
- Sin pendientes: `{ "pendientes": [], "requiere_reaceptacion": false }`.
- FE falla abierto si esto no responde; la garantía sigue siendo el trigger de DB.

---

## 4 · `POST /legal/arrepentimiento`

| | |
|---|---|
| Auth | `@Public()` — Res. 424/2020, sin sesión |

```json
{ "nombre": "Ana Pérez", "email": "ana@example.com", "detalle": "Plan estudio, contratado el 10/08" }
```

- Los tres campos son obligatorios y no vacíos; `email` con forma de email. Falla → `400 invalid_input`.
- Inserta en `solicitudes_arrepentimiento` (`estado = 'recibida'`); el `codigo` lo genera el trigger.
- Si viene un Bearer válido, se guarda `usuario_id`; si no, queda `NULL`. Un token inválido **no** hace fallar el endpoint: es público.
- Notifica a Operaciones por email. El fallo del email se loguea y no revierte la solicitud — perder la fila es peor que perder el aviso.

```json
{ "id": "ARR-0001", "received_at": "2026-08-14T15:02:00.000Z" }
```

- `id` es el `codigo`, el número de seguimiento que se le muestra al usuario.
- Rate limit por IP → `429 too_many_requests`. **El contador vive en Postgres desde el 17/08** (`rate_limit_counters`), así que el límite se sostiene con varias réplicas y en serverless — antes vivía en memoria del proceso y no limitaba nada fuera del deploy de proceso único.
- La clave es la IP del cliente resuelta con `resolveClientIp(x-forwarded-for, @Ip())`, **no `@Ip()` sola**: no hay `trust proxy` configurado, así que `@Ip()` es el reverse proxy y todos los visitantes caerían en un único contador compartido — con el contador ahora global, la sexta solicitud de cualquiera daría 429.
- **Falla abierto**: si el contador no está alcanzable, la request pasa y se loguea. El formulario de arrepentimiento es una obligación legal (Res. 424/2020); un problema del limitador no puede bajar el canal. La versión en memoria no podía fallar, la de Postgres sí.

---

## 5 · `GET /legal/aceptaciones/export`

| | |
|---|---|
| Auth | Bearer + `@Roles("admin")` |
| Respuesta | `text/csv` como attachment |

Query params, todos opcionales: `usuario_id`, `desde` (ISO), `hasta` (ISO), `document_type`, `version`. Un `desde` posterior a `hasta` → `400 invalid_input`.

**Cap de filas (23/08):** el export lee hasta `exportMaxRows = 10000` filas (`legal.types.ts`). Si los filtros devuelven más, la respuesta es `400 { code: "export_too_large" }` con un mensaje que pide acotar el rango de fechas o los filtros, **antes de construir el documento** — el log completo no se arma en memoria. Aplica igual a la variante PDF de abajo. Con ≤ 10.000 filas el output no cambia.

Columnas, en este orden — son las seis del instructivo:

```csv
user_id,document_type,document_version,accepted_at,ip,user_agent
```

- `accepted_at` en ISO UTC. `user_agent` escapado con comillas dobles según RFC 4180.
- Orden estable: `accepted_at DESC, id`.
- Header `Content-Disposition: attachment; filename="aceptaciones-<desde>-<hasta>.csv"`.
- Rol distinto de `admin` → `403 forbidden_role` (lo tira `RolesGuard`).

**Variante PDF: `GET /legal/aceptaciones/export/pdf`** (17/08). Mismos query params, misma validación de rango, mismo orden y mismas seis columnas; cambia el renderer y el `Content-Type` (`application/pdf`, attachment con extensión `.pdf`). Cierra el "CSV y PDF" del checklist §07. Mismo cap de 10.000 filas y mismo `400 export_too_large` que el CSV.

- El PDF se genera sin dependencia nueva (`legal/acceptance-pdf.ts`): PDF 1.4 mínimo, Courier, una página por bloque de filas. `agents/back/AGENTS.md` declara que no hay librería de PDF en el repo y no se agregó ninguna.
- El `user_agent` **se envuelve en líneas de continuación, no se trunca**: es prueba, no decoración.
- Caracteres fuera de WinAnsi salen como `?`. Es deliberado: mantiene el offset en bytes igual al largo del string, y de eso depende que la tabla `xref` sea válida y que el archivo abra en un lector real.
- Sin filas para los filtros aplicados → PDF válido de una página que lo dice, no un archivo vacío.

---

## 6 · Aviso de cambio de versión (job, no ruta pública)

| | |
|---|---|
| Disparo | `@Cron(CronExpression.EVERY_HOUR)` + `GET /internal/legal/avisos/sweep` |
| Auth del endpoint | `@Public()` + `Authorization: Bearer <cronSecret>`, `timingSafeEqual` — copia exacta del patrón de `internal/vencimiento/sweep` |
| Respuesta | `{ "swept": true }` |

Barrido:

1. Busca en `legal_documents` las filas con `valid_from > now()` dentro de la ventana de preaviso (default 10 días, configurable).
2. Para cada una, recorre `usuarios` con `activo = true` y emite un email por usuario.
3. Escribe la traza en `avisos_version_legal` (ver `migraciones-nuevas.md`) con `ON CONFLICT DO NOTHING` sobre `(usuario_id, tipo, version)`. **Esa es la idempotencia**: el índice único, no un chequeo previo.
4. Una publicación cuya anticipación es menor a la ventana mínima se notifica igual y se loguea como incumplimiento del plazo — un aviso que falla en silencio es el peor caso posible.
5. Los fallos por usuario se acumulan con `Promise.allSettled` y se loguean; un destinatario caído no aborta el barrido.

---

## 7 · `POST /suscripciones/:id/baja`

| | |
|---|---|
| Auth | Bearer |
| Módulo | `pagos/suscripciones.controller.ts` (ruta nueva sobre el controller existente) |

- Sin body.
- El caller tiene que ser el titular: `usuario_id = caller`, o pertenecer al `estudio_id` dueño. Cualquier otro caso → `404 suscripcion_not_found` (no se distingue "existe pero no es tuya" de "no existe", igual que `MembershipService`).
- Estado distinto de `activa` → `409 conflict`.
- **Compensatoria, no transaccional** (corregido el 17/08 — esta ficha decía lo contrario): `cancelActiva` es un único `UPDATE ... WHERE estado = 'activa'` que commitea solo, después corre `MercadoPagoClient.cancelSubscription(suscripcionId)`, y si eso falla se llama a `restoreActiva` y se re-lanza. Hacer la llamada de red dentro de la transacción tendría una conexión del pool tomada hasta 30s.
- Después del commit, confirma por email al titular. El fallo del email se loguea y no revierte la baja.
- **`cancelSubscription` informa si la pasarela tenía algo que cancelar** (17/08): devuelve `{ cancelled: boolean }` y el servicio loguea un `warn` explícito cuando es `false`. Las suscripciones se cobran como preferencias one-off, así que casi nunca hay un `preapproval` que cancelar y hasta ahora la baja informaba éxito sin decir que la pasarela quedó intacta. **El tilde "baja verificada en el panel de la pasarela" del checklist sigue sin poner**: ponerlo requiere migrar el checkout a `preapproval`, que cambia el flujo de cobro vivo y no se puede verificar sin credenciales de MP. Lo que se eliminó es el falso positivo, no la deuda.

```json
{ "id": "…", "estado": "cancelada", "fecha_fin": "2026-08-15T12:00:00.000Z" }
```

---

## 8 · `POST /legal/contacto`

| | |
|---|---|
| Auth | `@Public()` |

```json
{ "nombre": "Ana Pérez", "email": "ana@example.com", "mensaje": "…" }
```

- Validación y rate limit idénticos a §4.
- Inserta en `solicitudes_contacto` con `received_at` — la fecha de ingreso es lo que hace sostenible el plazo de respuesta declarado.
- Rutea por email a Operaciones; el fallo del envío se loguea y no revierte la fila.

```json
{ "id": "CON-0001", "received_at": "2026-08-15T12:00:00.000Z" }
```

---

## 9 · `GET /legal/documentos/:tipo/programada`

Pedido §1 de `docs/pedidos-frontend-a-backend.md`. Desbloquea el banner de aviso in-product (punto #16).

| | |
|---|---|
| Auth | `@Public()` — mismo criterio que `GET /legal/documentos/:tipo` |
| Módulo | `apps/api/src/legal/legal.controller.ts` |

- `:tipo` ∈ `terms` \| `privacy`. Cualquier otro valor → `400 invalid_input`.
- Devuelve la fila de ese `tipo` con `valid_from > now()`: la simétrica exacta de `findVigente`. Las dos lecturas son disjuntas, así que el banner y la re-aceptación bloqueante nunca hablan de la misma versión.
- Con más de una programada, devuelve la de `valid_from` más cercano — es la que corresponde anunciar.
- **Respuesta: el mismo `LegalDocumentView` de §1.** No un shape propio, para que FE reuse mapper, tipo y renderer, y el banner pueda ofrecer "leer el texto nuevo" sin una segunda llamada.

```json
{
  "tipo": "terms",
  "version": "v2.0",
  "contenido": "…texto completo…",
  "valid_from": "2026-09-01T00:00:00.000Z",
  "valid_to": null,
  "is_substantial": true,
  "resumen_cambios": "Cambió cómo se cobra el servicio."
}
```

- **Sin versión programada → `404 legal_document_not_found`**, no `200` con body `null`. FE ofrecía las dos y aceptaba cualquiera; se eligió el `404` por dos razones: es consistente con el endpoint hermano, y Nest no serializa `null` como JSON — `res.send(null)` de Express manda body vacío con `content-type: text/html`, así que el `200 null` habría pedido un `@Res` manual y que FE tolerara un body vacío. El backed service de FE ya mapea ese código a "no hay".

---

## 10 · `GET /suscripciones/vigente`

Pedido §2 de `docs/pedidos-frontend-a-backend.md`. Desbloquea el botón de baja online (punto #19/#20): FE ya no necesita un id sintético.

| | |
|---|---|
| Auth | Bearer |
| Módulo | `pagos/suscripciones.controller.ts` |

- Sin parámetros: el servidor resuelve la titularidad desde el token. Un owner que mandara el cliente sería una forma de leer el plan de otro.
- **Misma resolución que la baja**, y misma precedencia que `PlanLimitService`: la suscripción personal (`usuario_id = caller`) **gana siempre** sobre la del estudio. El orden es explícito en la query — primero la propia, después `estado = 'activa'`, después la más reciente por `created_at`. Ordenar solo por estado y fecha devolvía la del estudio cuando era más nueva, y como el botón de baja de FE cancela el id que devuelve esta lectura, eso cancelaba el plan de todos los miembros del estudio.
- **La rama del estudio solo aplica al titular**: `rol = 'estudio'` y `activo`, el mismo criterio que exige el trigger anti-contratación para poder contratar. Un `parte` que apenas carga ese `estudio_id`, o un titular dado de baja, recibe `404`. Sin eso, esta lectura le revelaba el id a un no-titular y `POST /suscripciones/:id/baja` se lo aceptaba.
- De las del titular devuelve **una**. Una suscripción ya dada de baja se sigue devolviendo, con su `fecha_fin` — y FE **no** la muestra como "tu plan actual", solo `activa` lo es.
- **`fecha_fin` es el instante en que se registró la baja, no el fin del período pagado** (corregido el 18/08: esta ficha decía lo segundo y era falso). Lo escribe `cancelSuscripcion` con `now()`, igual que documenta §7. **No existe hoy ningún dato del fin del período cubierto por el último cobro**: `suscripciones` tiene `fecha_inicio` y `fecha_fin` y nada más. Exponer un `vigente_hasta` real depende de cómo se modele el cobro cuando el checkout deje de ser mock, así que **no se promete acá**. FE ya alineó su copy con lo que la columna guarda.
- **`estado` puede ser cualquiera de los cuatro valores de `estado_suscripcion`**: `activa`, `cancelada`, `vencida`, `pendiente_pago`. El orden **prioriza** `activa`, no filtra. `pendiente_pago` sale a propósito, porque es el default de la columna y por lo tanto lo que deja `POST /suscripciones` hasta que se acredite el pago: filtrarlo haría que la pantalla diga "no tenés plan" justo después de contratar, e invitaría a contratar de nuevo. Quien consuma esto tiene que contemplar los cuatro.
- Sin ninguna → `404 suscripcion_not_found`. Mismo código que devuelve la baja para una suscripción que existe y no es del caller: un ajeno no puede distinguir "no es tuya" de "no existe".

```json
{
  "id": "…",
  "plan_id": "…",
  "estado": "activa",
  "fecha_inicio": "2026-08-01T00:00:00.000Z",
  "fecha_fin": null
}
```

- Las columnas salen del allowlist `suscripcionVigenteColumns` (`pagos/pagos.types.ts`), con compile-guard: si el allowlist y el tipo se desalinean, falla `tsc`, no un reviewer.
- `fecha_inicio` y `fecha_fin` pasan por `normalizeTimestamp`.

---

## 11 · `GET /suscripciones/uso`

Pedido §3.1 de `docs/pedidos-frontend-monetizacion.md`. Desbloquea el medidor de uso del dashboard (*"2 de 3 negociaciones este mes"*) y que el modal de límite se anticipe.

| | |
|---|---|
| Auth | Bearer |
| Módulo | `pagos/suscripciones.controller.ts` |

- **Misma titularidad que §10**: personal (`usuario_id = caller`) antes que estudio, y la rama del estudio sólo para el titular (`rol = 'estudio'` y `activo`). Un `parte` que apenas carga el `estudio_id` recibe `404` aunque su estudio tenga plan.
- **"Con plan" es `estado IN ('activa','vencida')`** — el mismo conjunto que acepta `consume_quota`. A diferencia de §10, acá `pendiente_pago` y `cancelada` **no** cuentan: no hay período ni cupo que medir, y la respuesta es `404 suscripcion_not_found`, el mismo código que FE ya mapea a "no tengo plan".
- `period_start` / `period_end` salen de la suscripción **del pagador**; `usado` sale de `usage_counters` por el `usuario_id` **del caller** — el espejo exacto de `consume_quota`.
- **Sin fila en `usage_counters` para el período ⇒ `usado: 0`**, nunca 404. `consume_quota` crea la fila recién en el primer consumo.
- **`limite: null` ⇒ ilimitado** (plan Corporativo, `max_*_per_period` NULL).
- **`clientes` sólo para el titular de un estudio**; para el resto va `null` entero, no `{ usado: 0, limite: null }`.
- **Período NULL en una fila activa/vencida** (todas las anteriores al 03/09): la primera lectura calcula la ventana de 30 días anclada en `fecha_inicio` que contiene `now` (`k = floor((now − inicio) / 30d)`), la persiste en `current_period_start/end` y recién entonces lee. Se escribe una sola vez (`UPDATE ... WHERE ambas IS NULL`); un período ya persistido nunca se avanza ni se extiende desde acá. Si `fecha_inicio` también es NULL, el ancla es `now`.

```json
{
  "period_start": "2026-08-14T00:00:00.000Z",
  "period_end": "2026-09-13T00:00:00.000Z",
  "negociaciones": { "usado": 2, "limite": 3 },
  "clientes": null
}
```

- Timestamps por `normalizeTimestamp`. Tipos con compile-guard en `pagos.types.spec.ts`: `usado` sigue a `usage_counters.*_created`, `limite` a `planes.max_*_per_period`, y el allowlist de `usage_counters` no puede incluir `created_at` (db-types la declara, la tabla no la tiene).

---

## 12 · `402 quota_exceeded` en `POST /casos`, y la extensión del envelope

Pedido §3.2 de `docs/pedidos-frontend-monetizacion.md`. Cierra el ciclo con §11: el consumo real de la cuota de negociaciones.

- **El envelope no cambia de forma**: sigue siendo `{ "error": { "code", "message" } }`, y `AllExceptionsFilter` ahora **pasa los campos adicionales** del body de una `HttpException` dentro de `error`. `code` y `message` siguen siendo obligatorios; `statusCode` (y el `error` de las excepciones built-in de Nest) nunca viajan. Toda excepción existente sin campos extra (401, 404, 409) responde exactamente lo mismo que antes.
- `POST /casos` consume una negociación llamando a `public.consume_quota(caller, 'negotiation')` **dentro de la misma transacción** que inserta `casos` + `caso_partes`. Si el insert falla, el contador no queda incrementado; si `consume_quota` levanta, no se crea el caso.
- `P0002` (`QUOTA_EXCEEDED`) se mapea en `toDomainError` a `QuotaExceededError` (402). El servicio lo completa con la misma lectura de §11 y lo relanza:

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "Quota exceeded for this period",
    "recurso": "negociaciones",
    "usado": 3,
    "limite": 3,
    "period_end": "2026-09-13T00:00:00.000Z"
  }
}
```

- **Sin `upgrade_url`**, como pidió FE.
- **El detalle es opcional**: si la lectura de §11 responde 404 para el caller (un miembro de estudio no titular, ver la deuda de abajo), el 402 sale sólo con `code` y `message`.
- **Respuesta a la pregunta 403/402: conviven.** `403 plan_limit_exceeded` (stock sobre `limite_casos`, `PlanLimitService`) corre **antes** y se mantiene; `402 quota_exceeded` (flujo sobre `max_negotiations_per_period`) lo decide la DB. Los dos llevan el mismo cuerpo de detalle; el 403 usa `recurso: "casos"` con `usado`/`limite` y sin `period_end` (un stock no tiene período).
- `P0001` de `consume_quota` (`NO_ACTIVE_SUBSCRIPTION`, `NO_BILLING_PERIOD`) sigue siendo el `409 conflict` genérico. Antes de consumir, la API persiste el período de la suscripción del caller si está en NULL (misma regla que §11), así que `NO_BILLING_PERIOD` sólo puede llegar para quien §11 no resuelve.
- **Período real desde el webhook**: un pago aprobado fija `current_period_start = now` y `current_period_end = now + 30 días` en el mismo `UPDATE` que pone `estado = activa` (`billingPeriodDays = 30`, spec PACTUM §5.2).
- **Deuda conocida**: `consume_quota` resuelve la suscripción del estudio para **cualquier** miembro (`usuarios.estudio_id`), mientras §11 sólo la resuelve para el titular. Un miembro no titular consume contra el plan del estudio pero no puede leer su uso ni obtiene el detalle del 402, y si la fila del estudio no tiene período todavía, recibe `409` en vez de que la API se lo complete. Queda anotado para DB/Producto: o `consume_quota` adopta el criterio de titularidad, o `/uso` se abre a los miembros.
