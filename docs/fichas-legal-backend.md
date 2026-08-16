# Fichas de función — módulo legal BE

**Fecha:** 15/08/2026 · **Rama:** `story/tyc-legal-backend` · **Autor:** Backend

La ficha que exige §06 del anexo de reparto, una por función. Es el handshake que FE necesita antes de cambiar el singleton de `services/legal.service.ts` de mock a backed. Los shapes de §1 a §4 son los que `mediacion-app/services/api/legal.api-service.ts` ya implementa y testea: **están congelados**. Los de §5 a §8 los define BE acá.

Error envelope global: `{ "error": { "code", "message" } }` (`common/filters/all-exceptions.filter.ts`). Códigos nuevos de este módulo: `legal_document_not_found`, `too_many_requests`, `suscripcion_not_found`, `invalid_cron_authorization` (reusado).

---

## 1 · `GET /legal/documentos/:tipo`

| | |
|---|---|
| Auth | `@Public()` — la página legal se ve sin sesión |
| Módulo | `apps/api/src/legal/legal.controller.ts` |

- `:tipo` ∈ `terms` \| `privacy`. Cualquier otro valor → `400 invalid_input`.
- Devuelve la fila de `legal_documents` con ese `tipo` y `valid_to IS NULL`.

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
- Rate limit por IP → `429 too_many_requests`. **Limitación conocida:** el contador vive en memoria del proceso. Frena abuso en el deploy de proceso único (Coolify); en serverless o con varias réplicas no limita nada. Está anotado en `_bmad-output/implementation-artifacts/deferred-work.md`.

---

## 5 · `GET /legal/aceptaciones/export`

| | |
|---|---|
| Auth | Bearer + `@Roles("admin")` |
| Respuesta | `text/csv` como attachment |

Query params, todos opcionales: `usuario_id`, `desde` (ISO), `hasta` (ISO), `document_type`, `version`. Un `desde` posterior a `hasta` → `400 invalid_input`.

Columnas, en este orden — son las seis del instructivo:

```csv
user_id,document_type,document_version,accepted_at,ip,user_agent
```

- `accepted_at` en ISO UTC. `user_agent` escapado con comillas dobles según RFC 4180.
- Orden estable: `accepted_at DESC, id`.
- Header `Content-Disposition: attachment; filename="aceptaciones-<desde>-<hasta>.csv"`.
- Rol distinto de `admin` → `403 forbidden_role` (lo tira `RolesGuard`).

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
- Transacción: lock `forUpdate` de la fila, `estado = 'cancelada'`, `fecha_fin = now()`.
- Antes de commitear invoca `MercadoPagoClient.cancelSubscription(suscripcionId)`; si falla, la transacción no se commitea (no se deja la baja registrada de nuestro lado y viva del lado de la pasarela).
- Después del commit, confirma por email al titular. El fallo del email se loguea y no revierte la baja.

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
