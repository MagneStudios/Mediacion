# Auditoría de desbloqueos — qué creíamos bloqueado y no lo está

**Fecha:** 09/09/2026 · **Autor:** Frontend · **Para:** Backend, DB y Producto
**Origen:** Backend avisó que veía endpoints sin consumir. Al revisar `docs/integration-contract.md` contra el resto de la documentación y contra el código, el problema resultó ser el inverso del que buscábamos.

---

## 0 · El resumen

Barrimos los 100 documentos de `docs/` contra el código real, en cuatro frentes en paralelo: los endpoints no consumidos, las secciones viejas del contrato, el schema, y las decisiones de cliente y producto.

**El hallazgo de fondo no es que falte trabajo. Es que casi nada de lo que damos por bloqueado lo está.** Lo que encontramos, ordenado por lo que cuesta destrabarlo:

| Lo que decimos | Lo que pasa |
|---|---|
| "El checkout no se puede cablear porque la app reportaría un pago que nadie cobró" | El webhook de MP confirma el cobro server-side desde hace semanas. **La app no reporta nada.** |
| "Un acuerdo por caso lo impone `UNIQUE (caso_id)`" | DB eliminó esa constraint el 06/09. **Lo impone un `if` en `insertDraft`.** |
| "`pago_a_cargo` es una columna al select" | **Nunca se escribe.** Agregarla al select devolvería `null` para siempre. |
| "No hay pedido de Producto para `PATCH /casos/:id/plazo` ni `/estado`" | Son **RN-08 y RN-10**, rol **Parte**, en la documentación técnica fundacional. |
| "Falta decidir qué fecha lleva un evento de calendario" | El cliente lo contestó el **07/08** (R-13). |
| "Facturación fiscal: decisión pendiente, bloqueante para lanzar" | El cliente la contestó el **07/08** (R-09), 13 días antes de que la spec la listara como abierta. |

Y un bug que no es de documentación: **el TTL de invitación es más del doble del que pidió el cliente**, y la app le dice al usuario el número correcto mientras el servidor honra otro.

---

## 1 · Lo urgente: el TTL de invitación miente

**R-04 es inequívoco** (`Cambios_Reunion_Mediacion_07-08-2026.md:43`):

> *"Toda invitación tiene **72 h** de vigencia desde su envío. Si no se acepta, el caso pasa a estado `EXPIRADO`."*

Las dos mitades están rotas, cada una de un lado distinto.

### 1.1 · El plazo implementado es 7 días

`apps/api/src/invitaciones/invitation-ttl.ts:1` — `const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;`

Nuestro copy dice la verdad del requisito, en los dos idiomas: *"Pasaron más de 72 horas desde que se envió"*. **El número correcto está en la app y el incorrecto en el servidor**, así que una invitación que declaramos muerta sigue siendo canjeable cuatro días más.

**Y el valor correcto está en la base, sin que nadie lo lea.** DB sembró el 10/08:

```sql
('invitacion_ttl_horas', '72', 'Horas de vigencia de la invitación (R-04)')
```

El módulo `configuracion` sólo expone tres claves de IA (`ia-allowlist.ts`), así que esa fila no la consulta nadie.

### 1.2 · Por qué se perdió un mes — y esto importa más que el bug

El pedido estaba escrito, con el archivo nombrado. `plan-implementacion-07-08-2026.md:35`:

> *"TTL 72 h recomendado como `configuracion.invitacion_ttl_horas` (editable sin deploy) **en vez de la constante de 7 días hardcodeada en `apps/api/src/invitaciones/invitation-ttl.ts`**"*

No se hizo. Pero `docs/prompts-db/implementar-cambios-schema.md:172` lo da por cumplido en una lista de verificación:

> *"`invitacion_ttl_horas` y `impuestos` existen en `configuracion` **y se leen desde el backend**."*

**Esa línea es falsa y es la razón por la que nadie lo revisó de nuevo.** Un ítem se tildó sin comprobarlo, y a partir de ahí todos los documentos posteriores heredaron la creencia. `integration-contract.md:165,217` registra *"Token TTL: 7 days"* como hecho verificado, sin nota de que el cliente pidió 72 h.

### 1.3 · La segunda mitad de R-04 no existe

**Nada escribe nunca `estado_caso = 'expirado'`** — ni `apps/api/src`, ni un trigger, ni un cron. La transición `nuevo → expirado` está permitida desde el 10/08 y el front lo soporta entero: el mapper y copy en los dos idiomas (*"Pasaron 72 horas y la otra parte no se unió, así que este caso quedó cerrado"*).

Es **la misma forma exacta** que `pendiente_suscripciones`, que encontramos el 04/09: estado en el enum, front listo, nadie lo escribe. Que el patrón aparezca dos veces sugiere barrer el enum entero de `estado_caso` buscando estados muertos.

**Qué pedimos:** decidir cuál de los dos números vale. Si es 72 h —que es lo que dice el requisito y lo que ve el usuario— el fix es leer `configuracion.invitacion_ttl_horas`, que ya existe. Y alguien tiene que escribir `expirado`.

---

## 2 · El checkout está desbloqueado, y eso explica la queja del cliente

`integration-contract.md:38` dice que no cableamos `POST /suscripciones` + `/pago` porque *"`pago` no confirma un cobro… cablearlo haría que la app reporte un pago aprobado y emita una factura por plata que nadie cobró"*. Marcado **"No bloquea — decisión escrita"**.

**Esa razón ya no existe.** La confirmación server-side está completa:

- `POST /suscripciones/:id/pago` → `{ init_point }` (`pagos.service.ts:63`)
- Webhook `@Public() POST /webhooks/mercadopago`, **con verificación HMAC** antes de aplicar nada
- `applyPayment`, al ver `aprobado`, escribe `estado: activa` + `fecha_inicio` + `current_period_start/end` en la misma transacción (`pagos.repository.ts:76-88`)

La app no reporta nada: abre el `init_point` y re-lee `/suscripciones/vigente`, que ya consumimos. **El pago lo confirma el webhook.**

### 2.1 · Y nuestra mitad está construida, probada y es inalcanzable

`usePaymentConfirmation` hace polling cada 3 s esperando `activa`, y su propio comentario dice *"The activation happens in the webhook, never in the callback"* — quien lo escribió entendía la arquitectura. Pero **nada navega a `/billing/callback`**.

### 2.2 · La consecuencia, que es la que le rompe las demos al cliente

`suscripciones.estado` arranca en `pendiente_pago`. En todo el código **sólo dos funciones escriben `activa`**: el webhook y `reactivate`. El checkout de la app dice *"Pagar (simulado)"* y no llama a ninguna.

⇒ **Nadie puede llegar a `activa` a través de la app.** Y el gate C-01 exige suscripción activa en **las dos partes** para sacar un caso de `nuevo`.

Eso es lo que el cliente reportó como *"la simulación de aceptación no funciona"*. El 04/09 lo diagnosticamos como dos bugs de FE y arreglamos el mensaje de error — correcto, pero era el síntoma. **La causa es que el camino al estado activo nunca se cableó**, y cablearlo no necesita un endpoint nuevo: faltan credenciales de sandbox de MP y conectar tres llamadas.

---

## 3 · Acuerdos modulares: DB destrabó y un `if` lo mantiene trabado

La migración 41 eliminó `acuerdos_caso_unique` el 06/09. Pero `apps/api/src/acuerdos/acuerdos.repository.ts:137-143` reimplementó la regla en código: antes de insertar consulta si el caso ya tiene acuerdo y tira `acuerdo_already_exists`.

*"Un acuerdo por caso"* —la constraint que citamos como bloqueante— **ya no la impone la base, la impone una función.** Es un cambio de una línea el día que se decida permitir la segunda materia.

> ⚠️ Y mientras exista, **nuestro workaround de FE deja de ser correcto en el mismo commit en que alguien lo relaje.** El cliente resuelve el acuerdo con `getForCase(caseId)` + verificar el id, apoyado en que hay como mucho uno. Eso lo garantiza hoy ese `if`, no el schema.

---

## 4 · Capacidad que existe en la base y nadie usa

Verificado con grep sobre todo `apps/api/src`:

| Qué | Desde | Consecuencia |
|---|---|---|
| **Todo el versionado P5** — `version`, `supersedes_agreement_id`, `vigente`, `valid_from` | 06/09 | **Cero referencias.** "Renegociar" es construible hoy |
| `negociaciones.estado` — nunca se escribe | 06/09 | Toda negociación queda en `borrador` para siempre |
| `items.negociacion_id` — se agrega y se backfillea, y el motor sigue leyendo posiciones **por caso** | 06/09 | Es la pregunta 1 que dábamos por abierta: la columna que la resuelve ya existe |
| `facturas` — tabla, CHECK, índice y RLS, con las columnas que nuestra pantalla de comprobante ya dibuja | 10/08 | Falta **un endpoint**, no schema |
| `suscripciones.cancel_at_period_end` | 21/08 | Ver §5 |
| `payment_events`, `envios_email`, `lawyer_requests` | 21/08 y 10/08 | Sin referencias |

---

## 5 · Un bug de producto con costado legal

`cancelActiva` (`suscripciones.repository.ts:174-178`) pone `estado: cancelada` **en el acto**, sin período de gracia. El gate C-01 exige `s.estado = 'activa'` en las dos partes.

⇒ **Si alguien da de baja a mitad de período, el caso de su contraparte deja de poder activarse ese mismo instante.** La contraparte no hizo nada y pierde el servicio.

`cancel_at_period_end` existe en el schema desde el 21/08, sin usar — el modelo correcto está previsto y no implementado. La baja online es la que exige la Ley 24.240 art. 10 ter; que además castigue a un tercero no es lo que esa norma pide.

---

## 6 · Tres decisiones que ya estaban contestadas

### 6.1 · `PATCH /casos/:id/plazo` y `PATCH /casos/:id/estado`

El contrato dice *"No hay UI que los use ni pedido de Producto para que la haya"*. **Son requisitos fundacionales**, y el rol es **Parte**, no panel (`Mediacion_Documentacion_Tecnica_v1_0.md:319-320`):

- **RN-10** — *"una parte puede fijar un plazo puntual (ej. respuesta para el día siguiente)"*
- **RN-08** — *"Cualquiera de las partes puede declarar expresamente el fin de una negociación"*

Nuestro propio `docs/frontend-redesign/state-machines.md:14` ya modela `nuevo → terminado: parte cierra (PATCH /casos/:id/estado)`.

**Qué desbloquea:** dos acciones que la app hoy no puede hacer. Fijar un plazo es además lo que le da sentido al semáforo, que hoy dibujamos como decoración de sólo lectura. Salvedad honesta: `plazo` necesita un date picker que el design system no tiene — eso es costo de implementación, no una decisión faltante.

### 6.2 · La fecha del evento de calendario

Lo teníamos como *"pregunta de Producto"*. El cliente la contestó el 07/08 (R-13): *"botón «Agregar al calendario» **en cada ítem con fecha**"*, y el punto 10 del doc v2 confirma que el cronograma va **dentro** del documento firmado — o sea que las fechas existen en el acuerdo por construcción.

⇒ La pregunta se cierra y **el pedido vuelve a Backend**: que `buildTareasFromAcuerdo` lleve la fecha del ítem a `tareas.fecha_evento`. Nuestro `TaskCalendarAction` ya existe, completo y sin consumidores.

Dos salvedades: R-13 es prioridad **Baja / post-MVP** en la tabla del propio cliente, así que esto destraba la decisión y no necesariamente el calendario; y los **eventos recurrentes** que R-13 pide no tienen dónde vivir — `fecha_evento` es un timestamp único.

### 6.3 · Facturación fiscal

`PACTUM-monetizacion-spec.md:742` la lista en *"Decisiones pendientes — **bloqueantes para lanzar**"*. El cliente la contestó 13 días antes en R-09: factura el sistema, vía ARCA, sobre el neto, con importes discriminados en el checkout.

⇒ Sale de la lista de bloqueantes. Lo que falta no es una decisión sino **credenciales de ARCA y un módulo de emisión en BE**.

---

## 7 · Un hueco de producto que no está en ningún doc

**`counterpartyReady` es ilegible contra backend real, a propósito.** No hay endpoint que diga si la otra parte cargó posiciones, porque el timing de un envío privado es en sí mismo una filtración (RN-01), y el módulo `actividad` excluye los eventos de `items` por eso mismo.

La consecuencia, escrita en `negotiation.backed-service.ts:33-43`: el estado `waiting_other_party` **nunca aparece** contra la API real. El usuario se entera por una acción que falla y un `both_parties_required`. No está en §3, ni en §5, ni en ninguna ficha.

---

## 8 · Documentación que induce a error

Cosas que hay que corregir porque alguien va a planificar encima:

- **`docs/database.md` documenta los dos enums nuevos con valores que no existen.** Dice `custodia_hijos` donde se creó `tenencia` —justo el valor que pedimos— y dice que `estado_negociacion` es `negociando|acordada` cuando tiene cinco valores. En tres lugares afirma que el backfill usó `materia='otro'`, cuando usó `NULL`, que es lo contrario.
- **`decisiones-db/2026-09-02-c01-c02-cliente.md:48`** afirma que *"`GET /casos/:id/invitaciones` sigue devolviendo `pago_a_cargo` sin cambios"*. **Nunca lo devolvió.**
- **`prompts-db/implementar-cambios-schema.md:172`** — la línea falsa del §1.2.
- **`integration-contract.md` §1, §3, §5 y §6** describen un código que ya no existe: los tres bloques de *"Blocking — the app cannot talk to the API at all"*, los seis *"Backend gaps"* y cuatro de los cinco *"Needs new schema"* están cerrados. §6 dice que `/case/join` está "intencionalmente sin cablear" y hoy llama a `POST /casos/unirse` y distingue tres estados de error.

---

## 9 · Qué proponemos, por orden

**Nada de esto es de FE salvo donde se aclara.**

| # | Qué | Quién | Por qué primero |
|---|---|---|---|
| 1 | Decidir el TTL y leerlo de `configuracion`; escribir `expirado` | BE + Producto | Hoy la app le miente al usuario sobre su propio caso |
| 2 | Credenciales de sandbox de MP, y cablear el checkout | Ops + **FE** | Destraba el gate C-01, que es la queja del cliente |
| 3 | `cancel_at_period_end` en la baja | BE | Hoy una baja castiga a la contraparte |
| 4 | Corregir la ficha de `pago_a_cargo`: son dos cambios, no uno | BE | Si no, se cierra creyendo que quedó hecho |
| 5 | Los tres endpoints de acuerdos modulares + §7.1 y §7.2 | BE | Sigue siendo lo que frena el refactor |
| 6 | Corregir `database.md`, el prompt de DB y la decisión del 02/09 | DB | Alguien va a planificar encima |
| 7 | `PATCH /plazo` y `/estado`: confirmar que se quieren, y el date picker | Producto + **FE** | Son RN-08 y RN-10, y nadie los reclamó en un mes |

---

*Cualquier corrección sobre este doc, respondemos acá.*
