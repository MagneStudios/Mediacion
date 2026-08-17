# Pedidos de Frontend — endpoints que faltan

**Fecha:** 16/08/2026 · **Autor:** Frontend · **Para:** Backend (DB no tiene nada pendiente, ver §3)

El recíproco de `docs/fichas-legal-backend.md`: dos endpoints que FE necesita para cerrar puntos del instructivo que el reparto nos asigna y que **hoy no podemos construir**. En ambos casos el dato ya existe en la base y en el código de BE; lo que falta es exponerlo.

Formato calcado de las fichas de BE para que se pueda implementar sin ida y vuelta. Si algún shape no les cierra, avisen antes de implementar — es más barato ajustar el contrato que descubrirlo integrando.

---

> **Respondido e implementado — 17/08/2026, Backend.** Los dos endpoints están, con los shapes de acá sin cambios. Fichas en `docs/fichas-legal-backend.md` §9 y §10; detalle en `docs/changelogs/2026-08-17.md`.
>
> - **§1:** elegimos **`404 legal_document_not_found`** para "no hay versión programada", la opción que ustedes marcaron como también válida. Dos razones: consistencia con el endpoint hermano, y que **Nest no serializa `null` como JSON** — `res.send(null)` de Express manda body vacío con `content-type: text/html`, así que el `200 null` habría pedido un `@Res` manual y que ustedes toleraran un body vacío. La respuesta es el mismo `LegalDocumentView`, como pidieron, y con más de una programada devuelve la de `valid_from` más cercano.
> - **§2:** `GET /suscripciones/vigente`, con la titularidad resuelta por el **mismo criterio que la baja** (personal primero, estudio después) — el "ojo con la titularidad" estaba bien visto. Devuelve también la suscripción ya cancelada con su `fecha_fin`, para que puedan decir hasta cuándo sigue vigente lo ya pagado.
> - **§3, párrafo final:** el agujero del punto #11 (`estudio_id` sin regla anti-contratación) **quedó cerrado** en `20260817120000_suscripcion_aceptacion_estudio.sql`. La regla que definimos: el titular del estudio (`rol = 'estudio'`, `activo`) aceptó los TyC vigentes.
> - **§4, segunda nota:** la baja en la pasarela **sigue siendo un no-op**, pero ya no silencioso: `cancelSubscription` informa si había algo que cancelar y el servicio lo loguea. El tilde del anexo sigue sin poner y ponerlo requiere migrar el checkout a `preapproval` — es decisión de Producto, no de implementación.
> - Los dos endpoints ya están consumidos desde FE en la misma rama (banner del #16 y botón de baja real), así que #16 y #19 quedan cerrados de los dos lados.

---

---

## 1 · `GET /legal/documentos/:tipo/programada` — aviso in-product (punto #16)

**Qué desbloquea:** el banner de aviso previo al cambio de versión.

El reparto nos asigna el punto #16 completo: *"**Aviso in-product** + re-aceptación bloqueante si el cambio es sustancial"*, y §05 lo repite en la tabla de fronteras (*"Publicación de versión → DB → BE → **FE (banner)**"*). El instructivo §4.8 pide avisar los cambios *"con anticipación razonable —como mínimo 10 días— por email a todos los usuarios activos **y con un aviso dentro del producto**"*.

FE tiene construida la mitad que actúa **cuando la versión ya entró en vigencia** (`ReacceptanceGate`, bloqueante). Falta el banner de los 10 días previos, y no hay con qué alimentarlo: `LegalRepository.findVigente` filtra `valid_from <= now`, así que `GET /legal/documentos/:tipo` nunca devuelve una versión programada. El dato existe de su lado —el tipo `PublicacionProgramada` y la consulta de `legal-avisos.scheduler.ts`— pero ninguna ruta lo expone.

| | |
|---|---|
| Auth | `@Public()` — mismo criterio que `GET /legal/documentos/:tipo` |
| Regla | La fila de ese `tipo` con `valid_from > now` (la simétrica de `findVigente`) |

**Respuesta sugerida: el mismo `LegalDocumentView` que ya devuelve `GET /legal/documentos/:tipo`.** No un shape propio: así FE reusa el mapper, el tipo y el renderer que ya tiene, y el banner puede ofrecer "leer el texto nuevo" sin una segunda llamada.

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

**Cuando no hay versión programada** —que es el estado normal casi todo el tiempo— sugerimos **`200` con body `null`**: no es un error, es la respuesta habitual. Si prefieren `404 legal_document_not_found` por consistencia con el endpoint hermano, **también nos sirve**: el backed service de FE ya mapea ese código a "no hay", así que no cambia nada de nuestro lado. Elijan lo que les quede más coherente y avisen cuál es.

**Si hubiera más de una programada**, devolver la de `valid_from` más cercano: es la que corresponde anunciar.

Con esto el banner es trabajo chico: mostrar desde cuándo rige y el resumen, y desaparecer solo cuando `valid_from` pasa y toma el relevo la re-aceptación bloqueante que ya existe.

---

## 2 · Lectura de la suscripción vigente — baja online (punto #19/#20)

**Qué desbloquea:** conectar el botón de baja al `POST /suscripciones/:id/baja` que ya implementaron.

Hoy no lo podemos consumir. El inventario de billing en `apps/api` es:

| Ruta | Estado |
|---|---|
| `GET /planes` | existe |
| `POST /suscripciones` | existe |
| `POST /suscripciones/:id/baja` | existe |
| `POST /suscripciones/:id/pago` | existe |
| **lectura de la suscripción vigente** | **no existe** |

La pantalla "Mi plan" (`app/profile/plan/index.tsx`) decide si muestra el botón —y de dónde saca el `:id`— desde `billingService.getCurrentSubscription()`, que es mock puro: el id que devuelve es sintético. Llamar a `POST /suscripciones/<id-mock>/baja` daría `404 suscripcion_not_found`.

Mientras tanto el botón queda declaradamente simulado. Un botón que siempre devuelve 404 es peor que uno que dice que es una demo, sobre todo siendo la baja online una obligación de la Ley 24.240 art. 10 ter.

| | |
|---|---|
| Ruta sugerida | `GET /suscripciones/vigente` (calca el precedente de `GET /legal/aceptaciones/vigente`) |
| Auth | Bearer |
| Sin suscripción | `200` con body `null` — "no tengo plan" es un resultado normal, no un 404 |

```json
{
  "id": "…",
  "plan_id": "…",
  "estado": "activa",
  "fecha_inicio": "2026-08-01T00:00:00.000Z",
  "fecha_fin": null
}
```

`estado` es lo que decide si FE muestra el botón (solo con `activa`), y `fecha_fin` lo que permite decir hasta cuándo sigue vigente lo ya pagado.

**Ojo con la titularidad:** según `agents/back/AGENTS.md`, `SuscripcionesService.resolveOwner` distingue suscripción personal (`usuario_id = caller`) de la de un estudio (`estudio_id`, con el caller perteneciendo a ese estudio). La lectura debería resolver la titularidad con el mismo criterio que la baja, o un usuario de estudio vería "no tenés plan" y no podría darse de baja de uno que sí tiene.

---

## 3 · DB no tiene nada pendiente de nuestra parte

El esquema de `20260814170000_tyc_legal.sql` cubre todo lo que FE consume, incluidos los campos que necesitan los dos endpoints de arriba (`valid_from`, `is_substantial`, `resumen_cambios` ya existen). Los dos pedidos son puramente de exposición: **no hace falta migración nueva**.

Lo único que sigue bloqueado del lado del esquema es el **seed de `legal_documents` v1.0**, y no depende de DB sino de **Administración**: los textos tienen 42 campos `[COMPLETAR]` (razón social, CUIT, domicilio, casillas de contacto, N° de registro AAIP, plazos de conservación). FE los muestra a propósito para que el bloqueo se vea.

Queda anotado, de las decisiones de DB del 14/08, que la regla anti-contratación **no cubre las filas con `estudio_id`** (el XOR) y que eso quedó como pendiente de BE/Producto. No afecta a FE, pero es un agujero del punto #11 mientras siga abierto.

---

## 4 · Dos notas para quien despliega (no son de desarrollo)

- **`OPERACIONES_EMAIL` vacío hace que el aviso se loguee en vez de enviarse** (`agents/back/AGENTS.md` §Config). Los formularios de arrepentimiento y contacto registran la fila igual, pero nadie se entera. El instructivo §5 pide "alguien que efectivamente responda el canal de contacto": conviene que esa variable esté en el checklist de despliegue, porque sin ella el canal existe en la base y no en la práctica.
- **La baja en la pasarela hoy es un no-op**: `HttpMercadoPagoClient.cancelSubscription` busca el preapproval por `external_reference` y no hace nada si no existe, porque las suscripciones se cobran como preferencias one-off. El checklist del anexo pide la baja "verificada en el panel de la pasarela" — ese tilde no se puede poner todavía, y no alcanza con que el endpoint responda 200.

---

## 5 · Estado de los puntos del instructivo que toca FE

| # | Punto | Estado |
|---|---|---|
| 1, 2, 3, 4, 5 | Página legal propia, links en footer y contratación, móvil, fecha visible | Cerrado |
| 6, 7, 8 | Checkbox no pre-tildado, casillas separadas, botón deshabilitado | Cerrado |
| 12 | Captura server-side de IP/UA | Cerrado (reasignado a BE, ver contrato §3.2) |
| 16 | Re-aceptación bloqueante | Cerrado |
| 16 | **Aviso in-product** | Cerrado (17/08, `VersionNoticeBanner` sobre `GET /legal/documentos/:tipo/programada`) |
| 17 | Botón de arrepentimiento sin login | Cerrado |
| 19 | Botón de baja online | Cerrado (17/08, contra `GET /suscripciones/vigente` + `POST /suscripciones/:id/baja`) |
| 21, 22 | Datos societarios y Ventanilla Única | UI lista; contenido pendiente de Administración |
| 23 | Formulario de contacto | Cerrado |
| 24 | Precios en pesos, finales, desglosados | Cerrado |

---

*Dudas o cambios a estos shapes: responder sobre este doc o en el PR #105.*
