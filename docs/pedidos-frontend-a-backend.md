# Pedidos de Frontend — endpoints que faltan (módulo legal / TyC)

**Fecha:** 16/08/2026, ampliado el 18/08 y el 25/08 · **Autor:** Frontend · **Para:** Backend (§1–§6, §8–§10) y **DB + Producto** (§7, agregado el 18/08 — deja sin efecto el "DB no tiene nada pendiente" del §3)

> **El inventario completo de la superficie de la API —qué consumimos, qué no y por qué— vive en `docs/integration-contract.md` §0.2 (25/08).** Este documento son los pedidos; ese es el estado.
>
> **Lo que está abierto hoy (25/08), de arriba hacia abajo por urgencia:** **§13** (el CI de `dev` está en rojo desde el PR #110, con el arreglo de una línea), **§10** (los datos para conectarnos a la API real — es lo único que nos frena para dejar de verificar contra mocks), **§8** (`pago_a_cargo` al select de invitaciones, una columna), **§11** (la fecha del evento de calendario, que hoy hace ininvocable a `POST /tareas/:id/calendario`), **§12** (onboarding — incluye un agujero: hoy cualquier usuario autenticado puede marcarse como biométricamente verificado), **§9** (`Content-Disposition` expuesto por CORS, para más adelante) y la **pregunta 1 de §7**, que sigue siendo de Producto.

> **Este documento es del módulo legal (TyC). Los pedidos de monetización viven en `docs/pedidos-frontend-monetizacion.md`** (23/08): `GET /suscripciones/uso`, el cuerpo del error de cuota, las dos columnas nuevas de `GET /planes`, el `back_url` del preapproval, y tres cosas de DB + Producto que bloquean la página de pricing.
>
> Se separaron porque son dos ciclos distintos con specs distintos, no porque este canal haya cambiado. El punto **#24** de §7 de acá y el §5.3 de allá **son el mismo problema**: el spec de monetización contesta la pregunta de la moneda que habíamos dejado abierta.

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

- **`OPERACIONES_EMAIL` vacío hace que el aviso se loguee en vez de enviarse** (`agents/back/AGENTS.md` §Config). Los formularios de arrepentimiento y contacto registran la fila igual, pero nadie se entera. El instructivo §5 pide "alguien que efectivamente responda el canal de contacto": conviene que esa variable esté en el checklist de despliegue, porque sin ella el canal existe en la base y no en la práctica. **Hecho el 23/08**: `docs/deploy-coolify.md` §3 lista `OPERACIONES_EMAIL` (y las otras tres variables del módulo legal) en la tabla Optional, con el efecto de dejarla vacía.
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
| 24 | Precios en pesos, finales, desglosados | **Mecánica cerrada, valores pendientes de Producto** — 23/08: existe `planes.moneda` (default `'ARS'`, lo que MP cobra de verdad), `GET /planes` la expone, la preference de MP la usa como `currency_id` (se eliminó el hardcode), el front formatea con la moneda del dato (se eliminó el `'USD'` de `format-plan-limit.ts`) y el catálogo muestra el **precio final con impuestos** con leyenda. Lo único que sigue abierto es la **pregunta 1 de §7**: los valores sembrados (9,99/19,99/25,00) parecen price points de dólar y nadie decidió resembrarlos (RN-15 ya decía "precios a confirmar"). Respuesta completa en **§7** |

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

> **Respuesta — 23/08, DB + BE + FE (rama `story/punto-24-precios-moneda`): la mecánica está cerrada; la pregunta 1 sigue ABIERTA para Producto.**
>
> **Lo que se hizo, en las tres capas del reparto:**
>
> - **DB (la fuente):** `planes.moneda TEXT NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS'))` (`20260823120000_planes_moneda.sql`, con rollback comentado; `mediacion.dbml` y `packages/db-types` actualizados). El default es `'ARS'` porque **el cobro real ya era en pesos**: `http-mercado-pago-client.ts` mandaba `defaultCurrencyId = "ARS"` a la preference de Mercado Pago desde el primer día — la columna registra la moneda del cobro que existe, no inventa una nueva. El CHECK admite solo `'ARS'` a propósito: vender en otra moneda es una decisión que no está tomada, y el día que se tome es ampliar el CHECK, no re-modelar.
> - **BE (el dato viaja):** `GET /planes` expone `moneda` (allowlist `planColumns` + compile-guard) y la preference de MP toma `currency_id` de la fila del plan (`planes.moneda as plan_moneda` → `SuscripcionForPreference` → `createPreference`). El hardcode `defaultCurrencyId` se eliminó y el spec del client ahora asserta `currency_id` — antes no lo hacía y un cambio de moneda pasaba sin test.
> - **FE (la muestra):** `formatPlanPrice(precio, moneda)` — la moneda llega por dato (`Plan.moneda` / `MockInvoice.moneda`), nunca por literal en un componente. El catálogo muestra el **precio final con impuestos** (el mismo `computeTaxBreakdown` del checkout) con la leyenda "Precio final, impuestos incluidos", y el neto queda como dato secundario. De paso se corrigió el header del checkout que renderizaba el literal `{{nombre}}` (anotado en `tyc-contrato-frontend.md` §10.5).
>
> **Respuesta a las tres preguntas:**
>
> 1. **ABIERTA — es de Producto y esto no la cierra.** La columna dice `'ARS'` porque eso es lo que MP cobra hoy; pero los **valores** sembrados (9,99 / 19,99 / 25,00) siguen pareciendo price points de dólar y **nadie decidió resembrarlos**. Si Producto confirma que son ARS, no hay nada que hacer (ya se muestran y cobran como ARS); si eran USD de referencia, hay que resembrar `planes.precio` — una migración de una línea, pero es plata: la decide Producto. RN-15 ya decía "precios y límites a confirmar", así que el esquema siempre lo trató como provisorio.
> 2. **Cerrada: el final.** La tarjeta del catálogo muestra el total con impuestos incluidos; el desglose discriminado (R-09) sigue en el checkout.
> 3. **Sin cambios:** el IVA sigue seedeado por país con la única entrada `AR` al 21% aplicando a los cuatro planes. No se tocó porque no era parte del pedido; si algún plan tributa distinto, también es una definición de Producto.
>
> **Dos salvedades que esta respuesta deja anotadas, no resueltas:** la preference de MP sigue mandando `unit_price` = precio **neto** mientras la UI muestra el final con IVA (preexistente; qué monto debe viajar a la pasarela es decisión BE/Producto pendiente), y el front todavía **no consume `GET /planes`** — el catálogo corre sobre el mock `plans.service.ts`, espejado a mano contra las migraciones.
>
> **La segunda salvedad quedó cerrada el 25/08 (FE, rama `feat/frontend-integracion-planes`):** el catálogo lee `GET /planes` de verdad — `services/api/plans.api-service.ts` + `plans.backed-service.ts`, con el mock intacto como fallback offline. Detalle en `docs/changelogs/2026-08-25.md`. **La primera sigue abierta** (el `unit_price` neto de la preference de MP es decisión BE/Producto). Dos cosas que la lectura real vuelve visibles y **no son de FE**: el catálogo va a mostrar **seis planes** (tres de un modelo de precios muerto) y `corporativo` se va a ver **gratis** por su `precio 0.00` — las dos están pedidas en `docs/pedidos-frontend-monetizacion.md` §5.1 y §5.2, y las dos se arreglan en la fuente: no vamos a filtrar por nombre desde el front.

---

## 8 · `pago_a_cargo` en `GET /casos/:id/invitaciones` — una columna al select

**Autor:** Frontend, 25/08 · **Para:** Backend · **No bloquea**, y es de una línea

**Contexto:** integramos `GET /casos/:id/invitaciones` (rama `feat/frontend-integracion-planes`). Estaba desde el commit `32515a3` del 30/07 y nunca lo habíamos consumido — el header de `cases.backed-service.ts` seguía afirmando que *"the API exposes only `POST`, with no read endpoint"*, que era cierto cuando se escribió y dejó de serlo sin que nos enteráramos. El costo mientras tanto: recargar la app volvía **irrecuperable** el código de invitación, y la única salida era emitir una segunda.

Ya está andando y **no les pedimos nada para que funcione**. Esto es lo único que quedó cojo.

**El pedido:** `InvitacionView` no trae `pago_a_cargo`. La columna existe (`20260810120000_cambios_reunion_07_08.sql`, `TEXT` nullable con CHECK no bloqueante) y `listByCaso` simplemente no la selecciona:

```ts
// apps/api/src/invitaciones/invitaciones.repository.ts, listByCaso
.select([
  "id", "caso_id", "tipo", "token", "email_destino", "estado",
  "fecha_envio", "created_at",
  // + "pago_a_cargo"
])
```

**Por qué nos importa.** Es R-07: quién paga la suscripción atada a esa invitación. Lo mandamos nosotros en el `POST` y **es el único campo que la lectura no nos puede devolver**, así que hoy `CaseInvitation.pagoACargo` pasó a ser `PagoACargo | null` — `null` cuando la invitación viene del servidor y no de esta sesión. Preferimos eso a defaultear `'invitador'`: adivinar mal en una invitación donde el invitador eligió "paga la otra parte" pone a la **parte equivocada frente a un paywall**.

**Qué esperamos leer:** el valor de la columna tal cual, `null` incluido (una invitación anterior a la migración no tiene el dato, y eso es una respuesta válida — no lo completen con un default del lado de ustedes). El día que llegue, `pagoACargo` vuelve a ser no-nullable de nuestro lado y el merge con la sesión se borra.

**Dos cosas que NO les pedimos**, para que no construyan de más:

- **Filtrar por `estado`.** Nos quedamos con la más reciente en `pendiente` y descartamos aceptadas/rechazadas/expiradas — es política de pantalla, no del endpoint.
- **Garantizar el orden.** `listByCaso` ordena por `created_at desc`, pero ninguna ficha lo promete, así que ordenamos nosotros con el `created_at` que ya viaja. Si algún día lo declaran en la ficha, sacamos nuestro sort; mientras tanto no queremos que la elección del código que ve un usuario dependa de un detalle de implementación.

**Y una nota de proceso, sin reproche:** este endpoint estuvo casi un mes construido y sin consumir porque nada nos avisó que había llegado. El changelog del 30/07 lo lista; el que no lo leyó fuimos nosotros. Lo levantamos porque revisamos la superficie entera de la API contra lo que consume la app, y salieron varios más (tareas, incumplimientos, export de acuerdo, onboarding). Los vamos integrando de a uno.

---

---

## 9 · `Content-Disposition` del export de acuerdo — para cuando guardemos un archivo

**Autor:** Frontend, 25/08 · **Para:** Backend · **No bloquea nada hoy**

Integramos `GET /acuerdos/:id/exportar` y `POST`/`GET` de incumplimientos. Los tres andan con los shapes que ya tienen; esto es una nota para más adelante, no un pedido urgente.

`exportAgreement` manda `Content-Disposition: attachment; filename="acuerdo-<id>.txt"`. **En Expo Web ese header es invisible para nosotros**: `applyCors` en `main.ts` no declara `exposedHeaders`, y sin `Access-Control-Expose-Headers` el navegador no deja leer ningún header fuera de la lista segura. En nativo sí se lee.

Hoy **no lo consumimos y no nos importa**, porque la app no guarda archivos: no tiene `expo-file-system` ni `expo-sharing`, así que "exportar" significa mostrar el texto y ofrecerlo al portapapeles. No hay nada que nombrar.

**El día que agreguemos guardado de archivos** —que es decisión nuestra + una dependencia nueva— vamos a necesitar el nombre, y ahí hay dos caminos:

1. `exposedHeaders: ["Content-Disposition"]` en `applyCors`. Una línea.
2. Nada, y lo derivamos nosotros (`acuerdo-<id>.txt`). Funciona, pero es una regla de ustedes copiada a mano de nuestro lado — exactamente el tipo de espejo que ya nos mordió con el catálogo de planes.

Preferimos (1), pero avisamos antes de necesitarlo, no después.

**Dos cosas que verificamos y están bien**, para que quede escrito:

- El export es el **único** endpoint de la API que no responde JSON. Le hicimos una puerta propia en el cliente HTTP (`requestText`) en vez de un flag en `request`, porque `request<T>` devolviendo `undefined` para una respuesta exitosa es un tipo que miente. Los **errores** sí siguen siendo el envelope de siempre — el filtro de excepciones contesta antes que el handler de texto — así que se parsean igual que en todas las rutas.
- `POST /acuerdos/:id/incumplimiento` mueve el acuerdo a `con_aviso` en la misma transacción. Lo consumimos **releyendo el acuerdo** después del write en vez de parchear el estado localmente: lo que la pantalla muestra es el estado del servidor, no nuestra suposición de lo que el write hizo.

---

## 10 · Los datos para conectarnos a la API real — lo único que nos frena ahora

**Autor:** Frontend, 25/08 · **Para:** Backend (§10.1, §10.2, §10.4) y DB (§10.3, §10.5) · **Bloqueante para verificar, no para seguir construyendo**

**Por qué recién ahora.** Hasta el fix de `custom_access_token` de hoy (`docs/changelogs-db/2026-08-25.md`), `POST /auth/v1/token` devolvía **500 en cada login**: no es que no hubiéramos levantado la app contra la API, es que no se podía entrar. Por eso las tres entregas de esta rama dicen, todas, "sin API viva". Ahora hay cuatro usuarios dev con login verificado en Cloud, y eso cambia.

Integramos cuatro endpoints esta semana —`GET /planes`, `GET /casos/:id/invitaciones`, incumplimientos y el export de acuerdo— y **los cuatro están verificados sólo contra mocks y contra la lectura de su código**. Queremos cerrar eso antes de seguir sumando integraciones a ciegas.

### 10.1 · Los tres valores del bundle

`mediacion-app/env.example` los lista; necesitamos los reales:

| Variable | Qué es | Quién lo tiene |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase Cloud (el gateway de Kong) | DB / quien creó el proyecto |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | La **anon** key | ídem |
| `EXPO_PUBLIC_API_URL` | Base de la API de Nest, sin barra final | BE — ver §10.2 |

**No manden la `service_role` key.** `config/env.ts` se niega a arrancar si detecta una en ese slot (decodifica el payload y busca `"role":"service_role"`), justamente porque Expo inlinea estos valores dentro del bundle del cliente: esa key ahí es RLS bypasseado para cualquiera que abra las devtools. La anon es publicable por diseño; la otra no.

Van a un `.env` local que **no se commitea**.

### 10.2 · ¿La API de Nest está desplegada en algún lado?

Si hay una URL alcanzable, con eso alcanza. Si no, la levantamos local contra la DB de Cloud y necesitamos saber **qué variables pedirle a la API**, que según `apps/api/src/config/config.ts` son dos obligatorias y una que nos importa a nosotros:

- `SUPABASE_JWT_SECRET` — el secret del proyecto de Cloud. Sin esto el guard rechaza todos los tokens.
- `DATABASE_URL` — la connection string de Cloud.
- **`CORS_ORIGINS`** — ver §10.4. Sin esto no hay Expo Web contra API desplegada, y es el que se olvida.

El resto (`OPENROUTER_API_KEY`, los ocho `DOCUSIGN_*`, `OPERACIONES_EMAIL`) los dejamos vacíos: degradan a placeholder o a log y no bloquean lo que vamos a probar.

### 10.3 · ¿Cloud tiene la Fase 1 de monetización aplicada?

Pregunta de una línea, con consecuencia visible. Si el seed de `20260821120000_monetizacion_fase1.sql` está en Cloud, **la pantalla de planes va a mostrar seis tarjetas** (`base`, `simple`, `plus`, `estudio` + `particular` + `corporativo`), tres de un modelo de precios que ya no existe, y `corporativo` se va a ver **gratis** porque su `precio` es `0.00` igual que el de `base`.

No es un bug que vayamos a tapar desde el front: es §5.1 y §5.2 de `docs/pedidos-frontend-monetizacion.md`, sigue abierto, y **se arregla en la fuente**. Lo preguntamos para saber si al conectarnos vamos a estar mirando eso o no, y para que nadie lo reporte como una regresión de la integración del catálogo.

### 10.4 · CORS para Expo Web

`applyCors` (`apps/api/src/main.ts`) es opt-in: con `CORS_ORIGINS` sin setear **no habilita CORS en absoluto**, que es la decisión correcta para que un deploy sin configurar no quede abierto. Pero significa que contra una API desplegada, desde el navegador, no nos entra una sola request.

Corremos Expo Web en `http://localhost:8081`. Si prueban desde otro puerto, el suyo. No hace falta comodín.

### 10.5 · Dos cosas que vimos al traer el merge

Ninguna es de FE y ninguna bloquea; las anotamos acá porque las vimos nosotros.

- **`scripts/setup_test_env.ps1` quedó apuntando a un archivo que no está en el repo.** Le agregaron el paso `tmp/test_00_dev_users.sql` y `tmp/` está en `.gitignore` (línea 65), así que un clone limpio falla en el primer paso. A nosotros no nos afecta si apuntamos a Cloud, pero a cualquiera que levante el entorno local sí.
- **La password de los usuarios dev quedó en un changelog versionado** (`docs/changelogs-db/2026-08-25.md`). Para usuarios de un proyecto de desarrollo es práctica normal; vale confirmar que ese proyecto de Cloud no comparte nada con datos reales, porque el repo es el lugar donde esa password va a seguir estando.

### 10.6 · Qué vamos a hacer con esto, para que sepan qué esperar

Runbook completo en `docs/frontend-conexion-backend.md`. En corto, las dos cosas que hoy están **deducidas y no observadas**, y que sólo la API real contesta:

1. **`GET /planes` — ¿`precio` viaja como `"9.99"` o como `9.99`?** El tipo de ustedes dice `number`, pero `pg` devuelve `numeric` como **string** salvo que se registre un type parser, y `apps/api/src/database/kysely.provider.ts` no registra ninguno. Nuestro mapper acepta los dos a propósito, pero ninguna spec de BE fija el shape de lectura, así que hoy nadie sabe cuál es. **Si es string, vale que lo sepan ustedes también**: cualquier consumidor que haga aritmética sobre ese campo se lleva una sorpresa.
2. **`GET /casos/:id/invitaciones` — el shape real de `InvitacionView`**, que leímos de `invitaciones.types.ts` y nunca vimos en el cable.

Los dos mappers toleran lo que venga; lo que queremos es dejar de decir "deducido" en los changelogs.

---

---

## 11 · `POST /tareas/:id/calendario` — pide una fecha que ninguna tarea tiene

**Autor:** Frontend, 25/08 · **Para:** Backend + Producto · **No bloquea:** integramos los otros dos endpoints de tareas y la sección anda

Integramos `GET /casos/:casoId/tareas` y `PATCH /tareas/:id`. **El tercero no**, y no es por falta de ganas.

### 11.1 · El problema, en tres líneas de su propio código

- `buildTareasFromAcuerdo` genera las tareas **sin `fecha_evento`** (`tarea-generation.ts`: sólo pone `acuerdo_id`, `caso_id`, `tipo` y `descripcion`).
- `resolveFechaEvento` hace `input.fecha_evento ?? tarea.fecha_evento` y tira `400 invalid_input` si los dos faltan (`tareas.service.ts`).
- `scheduleCalendarEvent` es lo **único** que escribe `fecha_evento` … y es justamente el endpoint que la exige.

O sea: **el endpoint que setea la fecha requiere la fecha**. Ninguna tarea generada puede pasar por ahí sin que el cliente invente una.

### 11.2 · Por qué no la inventamos nosotros

Podríamos mandar "hoy + 7 días" y el endpoint contestaría 200. Sería un evento de calendario en una fecha **que nadie eligió**, sobre un acuerdo legal. Preferimos no tener la función a tenerla mintiendo.

La otra salida es que la elija el usuario, y eso es UI nueva: **no hay ningún selector de fecha en toda la app** (el design system tiene `Input`, `Checkbox` y `SelectableCard`, nada de fechas). Antes de construirlo hace falta responder qué significa "la fecha" de una tarea como *"Económico — punto acordado: 45000"*, que es una pregunta de Producto, no de implementación.

### 11.3 · Las tres opciones, para que elijan

1. **El generador pone una fecha.** `buildTareasFromAcuerdo` la deriva del acuerdo (`fecha` + N días, o lo que Producto defina) y genera `tipo: 'evento_calendario'` donde corresponda. Nosotros no tocamos nada: la sección ya renderiza `eventDateLabel` cuando el dato viene.
2. **La elige el usuario.** Necesitamos la definición de Producto y construimos el selector. Avisen y lo estimamos.
3. **El endpoint se retira.** Si el calendario no está en el alcance de esta fase, mejor que no exista a que exista sin poder llamarse.

Nos sirve cualquiera. Lo que no nos sirve es dejarlo como está, porque hoy es una ruta que **no se puede invocar desde ningún cliente honesto**.

### 11.4 · Y una cosa que conviene que sepan de las tareas en general

Las tareas se generan en **un solo lugar**: el webhook de DocuSign, cuando todas las firmas de un acuerdo completan (`docusign-webhook.service.ts` → `generateForAcuerdo`). Nada más las crea.

Con las ocho `DOCUSIGN_*` sin configurar el webhook nunca dispara, así que **`GET /casos/:casoId/tareas` devuelve `[]` siempre**. No es un bug y nuestra sección lo dice con su estado vacío ("Las tareas van a aparecer acá una vez que el acuerdo las genere"). Lo anotamos para que nadie mire una lista vacía y reporte la integración como rota — y para que quede claro que **probar tareas punta a punta depende de DocuSign configurado**, no de nosotros.

---

## 12 · Onboarding — no lo vamos a construir todavía, y uno de los dos endpoints tiene un problema de diseño

**Autor:** Frontend, 25/08 · **Para:** Backend + Producto · **§12.2 conviene leerlo aunque el resto no**

Cerrando el inventario quedaban `POST /auth/biometria` y `POST /auth/consentimiento`. Los miramos para integrarlos y **decidimos no hacerlo**. Las razones no son de esfuerzo.

### 12.1 · Biometría: el proveedor no existe, y la app no puede validar nada

`Mediacion_Documentacion_Tecnica_v1_0.md` §"Calendario y biometría" dice, textual: *"verificación de identidad en el onboarding mediante **proveedor a definir**; se guarda el resultado de la validación, no la biometría cruda"*.

O sea que el proveedor es una decisión abierta. Y del lado de la app: **no hay ningún SDK biométrico ni de KYC instalado** (`expo-local-authentication` no está entre las dependencias, ni ninguna otra).

Entonces, la única pantalla que podríamos construir hoy es una que mande `{"resultado": "aprobada"}` **sin que ninguna validación haya ocurrido**. Es la app auto-certificando la identidad de su propio usuario, en un producto de mediación legal donde RN-12 trata la biometría como dato sensible. No lo vamos a hacer.

### 12.2 · Y ese es el problema: hoy **cualquier usuario autenticado puede aprobarse a sí mismo**

Esto no es una crítica de estilo, es su propia regla contradiciéndose entre dos rutas.

`apps/api/src/me/profile-allowlist.ts` dice, textual:

> *"`rol`, `email`, `activo`, `estudio_id` y **`verif_biometrica`** are deliberately absent: they are privilege or identity fields and **must never be settable from a self-service patch**."*

Correcto, y `PATCH /me` lo cumple. Pero **`POST /auth/biometria` hace exactamente eso**: sin `@Roles`, sin verificación de origen, sin firma de proveedor. `OnboardingService.recordBiometricResult` valida que `resultado` esté en `['aprobada','rechazada']` y escribe la columna. Cualquiera con un token válido manda `{"resultado":"aprobada"}` y queda verificado.

**Hoy el impacto es bajo**, y lo verificamos: `verif_biometrica` no gatea nada en `apps/api` — sólo viaja en `AuthenticatedUser` y en `GET /me`. Pero es un campo de identidad, y el día que algo dependa de él (habilitar un caso, firmar, contratar) el agujero pasa a ser el que decide.

**Lo que sugerimos**, y no es de FE decidirlo: que el resultado entre por donde entran los otros hechos verificados, o sea **un callback del proveedor server-side**, como ya hace `POST /webhooks/docusign` para las firmas. El cliente inicia la verificación; quién dice que salió bien es el proveedor, no el cliente. Con esa forma nosotros integramos sin problema: iniciamos, mostramos estado, y leemos el resultado de `GET /me`.

### 12.3 · Consentimiento: es la firma de identidad de DocuSign, y la mitad ya existe en otro lado

La documentación técnica (§Endpoints, línea de `/auth/consentimiento`) lo define como *"Firma de identidad (DocuSign) y aceptación de T&C"*. Dos cosas, y las dos tienen problema:

- **La firma de identidad por DocuSign no existe en ningún flujo de la app.** Lo único cableado a DocuSign es la firma del acuerdo. Un envelope de onboarding no lo genera ni lo consume nadie, y DocuSign está inerte hasta que se configuren las ocho `DOCUSIGN_*`.
- **La aceptación de T&C ya está resuelta y en producción**, por el módulo legal: `POST /legal/aceptaciones` con su tabla, su re-aceptación bloqueante y su banner. Grabar además `usuarios.consentimiento_fecha` sería un **segundo registro de lo mismo**, con dos fechas que pueden discrepar y ninguna regla que diga cuál manda.

Antes de tocarlo necesitamos saber si `consentimiento_*` es la firma de identidad (y entonces depende del envelope de onboarding, no de nosotros) o si quedó como duplicado del módulo legal (y entonces conviene retirarlo).

### 12.4 · Qué necesitamos para poder hacerlo

1. **El proveedor de biometría**, o la decisión de que el onboarding biométrico no entra en esta fase.
2. **La forma del endpoint** una vez que exista el proveedor — sugerencia en §12.2.
3. **Qué es `consentimiento_*`** y cómo convive con `legal_acceptances`.

Con eso construimos el flujo. Sin eso, lo único que podemos entregar es una pantalla que miente sobre una verificación de identidad, y preferimos no tenerla.

---

## 13 · El CI de `dev` está en rojo desde el PR #110 — diagnóstico y arreglo de una línea

**Autor:** Frontend, 25/08 · **Para:** DB · **No lo tocamos**: `supabase/migrations/` es de ustedes

Lo encontramos mirando por qué el PR #111 tenía checks rojos. **No eran de nuestro cambio: `dev` ya estaba rojo**, y sigue estándolo.

### 13.1 · `integration` — el `GRANT` a un rol que en CI no existe

```
psql:supabase/migrations/20260825000000_custom_access_token.sql:51:
ERROR:  role "supabase_auth_admin" does not exist
```

La última línea de la migración es `GRANT EXECUTE ON FUNCTION public.custom_access_token(jsonb) TO supabase_auth_admin;`. En un stack de Supabase real ese rol existe; el job `integration` de `ci-node.yml` corre las migraciones contra un **`postgres:16-alpine` pelado**, donde no. La migración aborta y el job sale con exit 3.

**Se ve en el CI de `dev` mismo**, en la corrida del merge del PR #110 — o sea desde antes de que existiera cualquier rama nuestra. Todo PR abierto contra `dev` hereda el rojo.

Que en local pase es esperable y no lo desmiente: `db reset` corre contra el stack completo de Supabase, con sus roles. El QA del changelog de DB (`36/36 migraciones OK`, `81/81 PASS`) es correcto **y CI igual se rompe**, porque los dos entornos no son el mismo.

**El arreglo, guardando el `GRANT` como ya guardan otras cosas en esa misma migración:**

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.custom_access_token(jsonb) TO supabase_auth_admin;
  END IF;
END $$;
```

Idempotente en los dos entornos: en Supabase real otorga como hoy, en el postgres pelado de CI no hace nada. **No lo aplicamos nosotros**: `agents/back/AGENTS.md` marca los límites de repo, y es justo lo que reclamamos en §6.4 cuando se cruzó al revés. Si prefieren que lo mandemos nosotros, avisen y va.

### 13.2 · `Vercel` — también rojo en `dev`, y no es del bundle

El check de Vercel está en `failure` sobre el HEAD de `dev`, igual que en los PRs.

Descartamos que sea del código de la app: corrimos localmente **los dos tramos exactos** del `buildCommand` de `vercel.json` — `pnpm --filter @mediacion/shared build` y `npx expo export --platform web` — y los dos salen con **exit 0**, con las 30 rutas exportadas. Lo que falla está del lado de Vercel (instalación, configuración del proyecto o cuota), no en lo que compilamos.

No tenemos acceso al panel para leer el log (`npx vercel inspect` pide credenciales). Quien lo tenga, ahí está la respuesta.

---

*Dudas o cambios a estos shapes: responder sobre este doc o en el PR #105.*
