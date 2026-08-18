# Pedidos de Frontend — endpoints que faltan

**Fecha:** 16/08/2026, ampliado el 18/08 · **Autor:** Frontend · **Para:** Backend (§1–§6) y **DB + Producto** (§7, agregado el 18/08 — deja sin efecto el "DB no tiene nada pendiente" del §3)

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

> **Corregido el 18/08: sí tiene una cosa, y es del instructivo.** Este título valía para el módulo legal y sigue valiendo para él. Pero al repasar el checklist entero apareció que **el punto #24 (precios en pesos, finales) no se cumple**, y ese punto arranca en el esquema: `planes.precio` no tiene moneda. Está en **§7**.

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
| 1, 2, 3, 4, 5 | Página legal propia, links en footer y contratación, móvil, fecha visible | Cerrado — con la salvedad de abajo sobre el móvil |
| 6, 7, 8 | Checkbox no pre-tildado, casillas separadas, botón deshabilitado | Cerrado |
| 12 | Captura server-side de IP/UA | Cerrado (reasignado a BE, ver contrato §3.2) |
| 16 | Re-aceptación bloqueante | Cerrado |
| 16 | **Aviso in-product** | Cerrado (17/08, `VersionNoticeBanner` sobre `GET /legal/documentos/:tipo/programada`) |
| 17 | Botón de arrepentimiento sin login | Cerrado |
| 19 | Botón de baja online | Cerrado (17/08, contra `GET /suscripciones/vigente` + `POST /suscripciones/:id/baja`) |
| 21, 22 | Datos societarios y Ventanilla Única | UI lista; contenido pendiente de Administración |
| 23 | Formulario de contacto | Cerrado |
| 24 | Precios en pesos, finales, desglosados | **Abierto** — corregido el 18/08: estaba mal dado por cerrado. Los precios se muestran en **dólares** (`currency: 'USD'` hardcodeado en `utils/format-plan-limit.ts`) con IVA argentino del 21% encima, el esquema no tiene columna de moneda, y el catálogo lista el neto y no el final. Pedido en **§7** de este doc; detalle en `tyc-contrato-frontend.md` §10.4 |

**Salvedad sobre el móvil.** El layout responsive está y las pantallas legales se leen sin zoom, pero el tilde del checklist §07 es *"flujo completo probado desde el celular"* y eso **no está hecho**: toda la verificación de este módulo se corrió en navegador de escritorio. Es nuestro y solo necesita a alguien con un teléfono; queda anotado acá para no volver a darlo por cerrado como pasó con el #24.

---

## 6 · Segunda ronda (18/08) — tres cosas de la entrega del 17/08

**Autor:** Frontend · **Rama:** `feat/frontend-tyc-cierre`

Los dos endpoints llegaron con los shapes de §1 y §2 sin desvíos, y eso está cerrado. Lo que sigue salió de revisar la entrega desde la pantalla: dos son desvíos entre la ficha y el código, y el tercero es una corrección de texto.

Ninguno bloquea. Los tres afectan a lo que la aplicación le dice al usuario sobre una obligación legal, así que preferimos preguntarlos antes que decidirlos por nuestra cuenta.

### 6.1 · `fecha_fin` significa dos cosas distintas en la misma ficha

`docs/fichas-legal-backend.md` la documenta dos veces, y no coinciden:

- **§7** (`POST /suscripciones/:id/baja`) la muestra como el resultado de la baja, y `SuscripcionesService.cancelSuscripcion` escribe `new Date().toISOString()`: es **el instante de la cancelación**.
- **§10** (`GET /suscripciones/vigente`) dice que la suscripción cancelada se sigue devolviendo con su `fecha_fin` *"para que FE pueda decir hasta cuándo sigue vigente lo ya pagado"*.

Implementamos §10. El resultado es que quien da de baja lee, en el acto, **"tu plan sigue vigente hasta el \<hoy\>"**. Buscamos el dato del fin del período pagado y no está en ninguna tabla: `suscripciones` tiene `fecha_inicio` y `fecha_fin`, y nada que represente el período cubierto por el último cobro.

**Lo que hicimos mientras tanto:** la pantalla dice solo lo que la columna guarda — *"Diste de baja este plan el {{date}}. No se vuelve a cobrar."* — sin ninguna promesa de vigencia. Es correcto pero es menos de lo que el usuario necesita saber.

**Lo que necesitamos que decidan.** Dos caminos, los dos nos sirven:

1. **Exponer el dato real.** Un campo más en la respuesta de §10 (`vigente_hasta`, o el nombre que prefieran) con el fin del período ya pagado. Requiere que exista: hoy no lo hay, y probablemente dependa de cómo se modele el cobro cuando el checkout sea real. Si el plan es que el acceso corte en el momento de la baja, decirlo así también es una respuesta.
2. **Corregir §10 de la ficha**, dejando `fecha_fin` documentada como "cuándo se registró la baja" en los dos lugares. No cambia código de BE y nuestra copy ya está alineada con eso.

Si es (1), avisen el shape antes de implementar y lo consumimos igual que el resto.

### 6.2 · `GET /suscripciones/vigente` no declara qué `estado` puede devolver

La ficha §10 dice que prefiere `activa` y después la más reciente, y el ejemplo muestra `"estado": "activa"`. Pero `findVigenteByOwner` **ordena** por estado, no filtra, así que los cuatro valores de `estado_suscripcion` pueden llegar. Los dos que no estaban contemplados de nuestro lado:

- **`vencida`** con `fecha_fin` en el pasado — se renderizaba como una baja voluntaria.
- **`pendiente_pago`**, que es el **default de la columna** (`estado estado_suscripcion NOT NULL DEFAULT 'pendiente_pago'`), o sea lo que va a dejar `POST /suscripciones` el día que el checkout sea real. Caía en "no tenés plan" e invitaba a contratar el mismo plan otra vez.

Ya los manejamos los cuatro (`utils/subscription-notice.ts`, con chequeo exhaustivo que rompe `tsc` si el enum crece). **Lo que pedimos es que la ficha lo declare**: qué valores puede devolver el endpoint es parte del contrato, y lo dedujimos leyendo su repositorio.

Y una pregunta de diseño que es de ustedes: ¿tiene sentido que `pendiente_pago` salga por una ruta que se llama `/vigente`? Si el criterio fuera "solo `activa` y `cancelada`", nuestra pantalla se simplifica y el filtro queda del lado que conoce la regla.

### 6.3 · §1 de la ficha quedó con la definición vieja de "vigente"

[Línea 25](fichas-legal-backend.md): *"Devuelve la fila de `legal_documents` con ese `tipo` y `valid_to IS NULL`"*, y dieciséis líneas más abajo el mismo §1 la corrige con la ventana de vigencia (`valid_from <= now AND (valid_to IS NULL OR valid_to > now)`).

**La implementación es la correcta**, esto es solo el texto. Pero es exactamente la definición que rompió `has_accepted_current`, y que `agents/back/AGENTS.md` ahora prohíbe explícitamente (*"Any new 'current legal version' query must use the vigencia window, never `valid_to IS NULL` alone"*). §1 está marcada como congelada y es la que leemos nosotros para escribir el mock: conviene que no tenga la versión que causó el incidente.

### 6.4 · Una nota, no un pedido

`agents/back/AGENTS.md` declara `mediacion-app/` read-only para BE en dos lugares (§Stack y §Repository boundaries), y `docs/reparto-tyc-devs.md` asigna los puntos #16 y #19 a FE. El commit `3e452c9` editó 20 archivos de `mediacion-app/`.

El código estaba bien hecho y bien comentado, y lo mantuvimos casi entero. Lo que se salteó fue la revisión de FE sobre copy y estados de pantalla, que es de donde salieron §6.1 y §6.2 —y dos cosas más que arreglamos sin pedirles nada, en `docs/tyc-contrato-frontend.md` §10.2. Para la próxima nos alcanza con la ficha: el consumo lo escribimos nosotros y sale más rápido que la ida y vuelta de corregirlo después.

---

> **Respondido — 18/08, Backend.** Los tres son correctos y los tres eran errores de la ficha, no del código. Corregidos en `docs/fichas-legal-backend.md`:
>
> - **6.1 — `fecha_fin`:** camino (2), corregir la ficha. §10 prometía "hasta cuándo sigue vigente lo ya pagado" y eso **no existe en el esquema**: la columna guarda el instante de la baja, como dice §7. Exponer un `vigente_hasta` real depende de cómo se modele el cobro cuando el checkout deje de ser mock, así que no lo prometemos hasta que exista. Su copy actual es la correcta.
> - **6.2 — `estado`:** declarado en §10. Salen los cuatro valores; el orden prioriza, no filtra. Y sobre la pregunta de diseño: **`pendiente_pago` sale a propósito**. Es el default de la columna, o sea lo que va a dejar `POST /suscripciones` el día que el checkout sea real; filtrarlo haría que la pantalla diga "no tenés plan" justo después de contratar. Su chequeo exhaustivo sobre el enum es la solución correcta.
> - **6.3 — §1:** corregido. Tenían razón en que era justo la definición del incidente.
>
> **Sobre 6.4:** tienen razón. `agents/back/AGENTS.md` declara `mediacion-app/` read-only para BE y el reparto asigna #16 y #19 a FE; el commit `3e452c9` igual tocó 20 archivos de la app. Fue por pedido explícito de Bruno de cerrar los puntos punta a punta en una sola corrida, pero la regla estaba escrita y correspondía avisar antes de saltarla, no después. La revisión de copy y estados que ustedes hicieron es exactamente lo que se salteó. De acá en más: ficha de nuestro lado, consumo del suyo.

---

## 7 · Punto #24 — no es de Backend: **DB + Producto**

**Autor:** Frontend, 18/08 · **Para:** Producto (la decisión) y DB (la fuente) · **No bloquea a BE**

El punto #24 del instructivo —*"precios en pesos, finales, con impuestos incluidos"*— **no se cumple**, y lo teníamos mal anotado como cerrado en §5 de este mismo documento desde el 16/08. No lo rompió nadie en el ciclo del 17/08; es anterior y se nos pasó a nosotros al dar el checklist por completo.

**Los cuatro hechos, verificados:**

1. **Todo precio de la app se muestra en dólares.** `mediacion-app/utils/format-plan-limit.ts` hace `new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })`, con la moneda hardcodeada. Alcanza a las tarjetas de plan, al desglose del checkout y al ABM de planes de admin. En pantalla: "US$ 9,99", "US$ 19,99", "US$ 25,00" (comprobado en el navegador).
2. **Sobre ese precio en dólares se calcula IVA argentino del 21%.** El seed de `configuracion.impuestos` es `{"AR":{"iva":21,"otros_impuestos":0}}` (`20260810120000_cambios_reunion_07_08.sql`). El checkout muestra neto US$ 9,99 → IVA US$ 2,10 → total US$ 12,09. Un precio en dólares con IVA argentino encima: una de las dos cosas está mal y las dos son visibles para el usuario.
3. **No hay moneda en ninguna parte del esquema.** `planes.precio` es `numeric(10,2)` con la nota *"Precio neto, sin impuestos (R-09)"*, y no hay columna de moneda ni en `mediacion.dbml` ni en la migración. El seed real es `25.00` para estudio. O sea que el `'USD'` del front **no está reflejando un dato: lo está inventando**.
4. **El precio listado no es el final.** Las tarjetas del catálogo muestran el neto; el total con impuestos aparece recién en el checkout. El instructivo pide que el precio que se muestra sea el final.

**Por qué no lo arreglamos nosotros y ya.** Cambiar `'USD'` por `'ARS'` es una línea, pero los valores sembrados (9,99 / 19,99 / 25,00) son puntos de precio de dólar: releerlos como pesos sería peor que el bug actual. El reparto asigna el #24 a **DB (fuente) → BE (cálculo) → FE (muestra)**, y lo que falta primero es la fuente.

**Las tres preguntas que necesitamos respondidas:**

1. **¿En qué moneda están esos números?** Si es ARS, hay que resembrar los valores. Si es USD, el #24 no se puede cumplir vendiendo así a consumidores en Argentina y eso vuelve a legales, no a desarrollo. Si es "USD como referencia, se cobra en pesos", hace falta una columna de moneda y una conversión, y eso es esquema.
2. **¿El catálogo lista el precio final o el neto?** El instructivo pide el final. Hoy lista el neto y el desglose vive un paso después.
3. **¿El IVA del 21% aplica a los cuatro planes?** Está seedeado por país con una sola entrada `AR` y no hay selección de país en ningún lado de la app.

**Lo que hacemos nosotros el día que se decida**, y es chico: sacar el `'USD'` hardcodeado de `format-plan-limit.ts` (un solo lugar, lo consumen las tres pantallas) y mostrar el total con impuestos en la tarjeta, no solo en el checkout.

Registro completo, con el detalle de dónde se ve cada cosa, en `docs/tyc-contrato-frontend.md` §10.4.

---

*Dudas o cambios a estos shapes: responder sobre este doc o en el PR #105.*
