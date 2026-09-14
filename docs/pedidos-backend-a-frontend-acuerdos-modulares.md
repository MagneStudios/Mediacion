# Pedidos de Backend → Frontend — Acuerdos modulares

**Fecha:** 09/09/2026 · **Autor:** Backend · **Para:** Frontend
**Responde a:** `docs/pedidos-frontend-acuerdos-modulares.md` y `docs/pedidos-frontend-a-backend-recolocar-negociaciones.md` §7

Cerramos los cuatro pedidos del doc de acuerdos modulares. Este documento lista **lo que ya está del lado nuestro y todavía no consumen**, más **lo que cambió de significado** en cosas que sí consumen.

Nada de esto rompe la app hoy: todos los cambios de contrato son aditivos, y los códigos de error que ya mapean siguen iguales.

---

## 1 · Resumen

| Pedido | Estado BE | ¿Lo consume el front? |
|---|---|---|
| §2.1 `GET /acuerdos/:id` | ✅ listo | ✅ **Sí, desde el 10/09** — `agreements.api-service.ts` `getById`; la bandeja, el dashboard, la firma y el historial leen por acuerdo (`docs/changelogs/2026-09-10.md`) |
| §2.2 `subject_type` + `version` en `GET /firmas` | ✅ listo | ✅ **Sí, desde el 10/09** — la fila dice "Tenencia · v2"; `null` cae al título del caso |
| §2.3 `GET /casos/:id/negociaciones` | ✅ listo | ✅ **Sí, desde el 10/09** — `NegotiationsListSection` dibuja una tarjeta por materia con su estado, ronda y acuerdo vigente (`docs/changelogs/2026-09-10-negociaciones-por-materia.md`) |
| §2.4 `POST /negociaciones/:id/renegociar` | ✅ listo | ✅ **Sí, desde el 10/09** — botón sólo con acuerdo vigente firmado; el `409` tiene copy propio y relee la lista |
| §7.1 `acordado` derivado | ✅ listo | ⚠️ **Sí, y ahora es correcto.** Ver §3 |
| §7.2 `pendiente_suscripciones` | ✅ listo (04/09) | ✅ Sí |

---

## 2 · Lo que está y no consumen

### 2.1 · `GET /acuerdos/:id`

```
GET /acuerdos/:id  →  { acuerdo, firmas }
```

Mismo bundle que `GET /casos/:casoId/acuerdo`, direccionado por acuerdo. **Es el que evita que la bandeja de firmas abra el acuerdo equivocado**: `GET /firmas` ya les manda `acuerdo_id`, y con N materias por caso el `caso_id` dejó de identificar un acuerdo.

Hoy `agreements.api-service.ts:74` navega por `caso_id`. Con dos materias, `findByCasoId` devuelve la primera que encuentre — no necesariamente la de la fila que el usuario tocó.

### 2.2 · Dos campos nuevos en `GET /firmas`

```diff
  {
    "acuerdo_id": "…", "caso_id": "…", "caso_nombre": "…", "caso_codigo": "…",
+   "subject_type": "tenencia" | "alimentos" | "bienes" | "otro" | null,
+   "version": 1,
    "acuerdo_estado": "…", "own_status": "…", "own_fecha_firma": null,
    "pending_signers": 1
  }
```

`subject_type` es `null` para una negociación del modelo viejo — **nunca `'otro'` de relleno**, como pidieron. `version` sube con cada renegociación (§2.4).

Sin estos dos, dos acuerdos del mismo caso se ven como dos filas idénticas en la bandeja. `ApiSignatureInboxEntry` (`agreements.api-service.ts:14`) todavía no los declara.

### 2.3 · `GET /casos/:id/negociaciones`

```json
[
  {
    "id": "…", "caso_id": "…",
    "subject_type": "tenencia",
    "metodo": "mediacion",
    "estado": "borrador" | "activa" | "acordada" | "cerrada" | "terminada",
    "ronda_actual": 2,
    "acuerdo_vigente": { "id": "…", "estado": "firmado", "version": 1 },
    "created_at": "…"
  }
]
```

Los tres alias que pidieron: `subject_type`←`materia`, `metodo`←`method`, `ronda_actual`←`round`. `acuerdo_vigente` es `null` — nunca un objeto vacío — cuando la negociación no produjo ninguno o los suyos fueron reemplazados. Un caso sin negociaciones devuelve `[]`, no 404.

### 2.4 · `POST /negociaciones/:id/renegociar`

```
POST /negociaciones/:id/renegociar   (sin body)
200 → { "negotiation_id": "…", "agreement_id": "…" }
```

Abre una ronda nueva sobre una materia ya firmada. En una sola transacción:

- el acuerdo vigente pasa a `vigente=false` — **se conserva**, sigue accesible por `GET /acuerdos/:id`;
- se crea el borrador siguiente (`version+1`, `supersedes_agreement_id`, contenido copiado del anterior como punto de partida) y es el `agreement_id` que devuelve;
- la negociación vuelve a `activa` con `ronda_actual+1`;
- el caso vuelve de `acordado` a `en_negociacion`.

Errores: `409 negociacion_not_acordada` (**código nuevo**) si la materia no tiene un acuerdo vigente **y firmado** — incluye renegociar dos veces seguidas. `404 negociacion_not_found` si el id no existe, si no son parte del caso, o si el caller es mediador (misma convención que `POST /propuestas/:id/responder`).

---

## 3 · Lo que cambió de significado en algo que sí consumen

### 3.1 · `estado_caso = 'acordado'` ahora es derivado — y su mapeo pasa a ser correcto

Antes se escribía **a la primera propuesta aceptada**, o sea antes de que existiera ningún acuerdo, y mucho antes de que se firmara. Ahora se calcula al completarse cada firma, y sólo cuando **todas** las negociaciones del caso tienen acuerdo vigente + firmado.

Consecuencia del lado de ustedes: `case-mapper.ts:91` mapea `acordado | cerrado | terminado` → `signed`. **Ese mapeo era optimista y ahora es exacto.** No hay que tocarlo — se los avisamos porque el estado llega más tarde en el ciclo que antes:

> **FE, 10/09:** lo tocamos el 09/09, antes de leer esto — `terminado` ya no mapea a `signed` sino a su propia clave `terminated` (`docs/changelogs/2026-09-09-plazo-y-terminacion.md`). Un caso terminado sin acuerdo decía "Firmado". `acordado` y `cerrado` siguen en `signed`, y con lo de arriba ese mapeo pasa a ser exacto, como dicen.

```
antes   aceptan ambas partes  →  caso 'acordado'  →  (generar acuerdo, firmar)
ahora   aceptan ambas partes  →  negociación 'acordada'  →  generar  →  firmar  →  caso 'acordado'
```

El estado por materia vive en `negociaciones.estado` (§2.3). Si hoy usan `casos.estado` para saber si una materia se puede negociar, con dos o más materias eso deja de alcanzar: la fuente es `estado` de cada negociación.

### 3.2 · `POST /casos/:casoId/acuerdo` — mismos códigos, otro disparador

| Código | Antes | Ahora |
|---|---|---|
| `422 caso_not_acordado` | el caso no estaba en `acordado` | ninguna negociación del caso está en `acordada` |
| `409 acuerdo_already_exists` | el caso ya tenía un acuerdo | **esa negociación** ya tiene uno vigente |

**Los dos `code` son los mismos**, así que el copy y el manejo que ya tienen siguen funcionando. Cambió el `message` (que no deberían estar mostrando) y el alcance del 409: con dos materias, tener acuerdo en tenencia ya no bloquea generar el de alimentos.

La ruta sigue siendo por caso y resuelve la negociación `acordada` que todavía no tiene acuerdo vigente. Si en algún momento quieren generar apuntando a una materia puntual, pídanlo y le agregamos la ruta por negociación.

---

## 4 · Orden que nos parece más útil

1. **§2.2** — dos campos al type de la bandeja de firmas. Es lo más barato y lo que desambigua la pantalla que ya tienen.
2. **§2.1** — cambiar la navegación de la bandeja a `GET /acuerdos/:id`. Cierra el riesgo de abrir el acuerdo equivocado, que es el único con consecuencia legal.
3. **§2.3** — la lista. Es lo que les deja dibujar N materias en vez de una.
4. **§2.4** — renegociar, cuando exista la pantalla que lo dispare.

Ninguno depende del anterior.

---

## 5 · Lo que sigue sin estar, y por qué

- **Plantillas, catálogo de cláusulas, `agreement_data`, PDF.** Sigue bloqueado por el cliente (`docs/respuestas-cliente-01-09-2026.md` §7). Por eso `renegociar` **copia** el contenido del acuerdo anterior en vez de re-renderizarlo.
- **Reemplazar el borrador de una renegociación con el contenido de la propuesta nueva.** Hoy, después de renegociar, la negociación queda con un borrador vigente que es copia del acuerdo viejo; cuando las partes acepten la propuesta de la ronda nueva, `POST /casos/:casoId/acuerdo` responde `409 acuerdo_already_exists`. Lo correcto ahí es **mandar ese borrador a firmar**, no regenerarlo. Sobreescribir su contenido depende del mismo catálogo de cláusulas que falta.
- ~~**`negotiationId` en las rutas de propuestas.** Ustedes dijeron que no lo consumen todavía; no lo inventamos.~~ **Resuelto el 10/09 — ver §6.**

> **FE, 10/09 — dos pedidos, chicos, para cerrar esto de verdad:**
>
> 1. **¿Cómo nace la segunda negociación de un caso?** La única inserción en `negociaciones` es la de `POST /casos` (`casos.repository.ts:188`, una por caso) y `negociacion.controller.ts` no tiene ruta de alta. El detalle ya dibuja N materias, pero hoy ningún entorno puede producir N > 1, así que no lo pudimos verificar más allá de los tests.
> 2. **`negotiationId` en las rutas de propuestas — ahora sí.** Es lo que deja que el resumen del flujo de propuestas y la elegibilidad sean por materia. Hasta entonces la lista dibuja el resumen una sola vez, por caso, y `getNegotiationEligibility` sigue leyendo `casos.estado` — tienen razón en §3.1 en que con N materias no alcanza, pero la fuente que nombran (`negociaciones.estado`) gobierna una tarjeta que sin ese id no puede actuar por materia.

---

## 6 · Respuesta a los dos pedidos del 10/09

Los dos están hechos. Changelog completo en `docs/changelogs/2026-09-10-alta-de-negociaciones.md`.

> **FE, 10/09 (2):** los dos consumidos el mismo día — `docs/changelogs/2026-09-10-post-desbloqueos-backend.md`. `AddMateriaCard` nueva (patrón `CaseDeadlineCard`, acción directa sin diálogo) ofrece las materias que el caso todavía no tiene abiertas; `useNegotiation`/`useRoundHistory`/las pantallas de negociación e historial ganaron un `negotiationId?` opcional, mismo patrón que `useAgreement(caseId, agreementId?)`.
>
> Sobre §6.2, línea 184: **`getNegotiationEligibility` no cambió de firma.** Las posiciones se siguen leyendo por caso (confirmado en su propio comentario, `negociacion.service.ts:234`), así que "¿hay contraparte?", "¿posiciones completas?" y el gate C-01 siguen siendo hechos del caso, no de la materia — pasarle `negociacion.estado` habría sido incorrecto. Lo que sí pasó a ser por negociación es `currentRound`/`currentProposal`, que es lo que la función necesitaba.
>
> Sobre §6.1.2 (la fila legacy sin materia): por ahora la dejamos como está — no nos molestó al probar, y `ronda_actual` de `GET /casos` depende de ella. Si en algún momento hace falta asignarle materia a esa fila, es pedido aparte.

### 6.1 · Cómo nace la segunda negociación — `POST /casos/:casoId/negociaciones`

```
POST /casos/:casoId/negociaciones
Body: { "subject_type": "tenencia" | "alimentos" | "bienes" | "otro" }
201 → NegociacionView    (el mismo shape que GET /casos/:id/negociaciones)
```

Devuelve la materia nueva con `estado: "borrador"`, `ronda_actual: 1` y `acuerdo_vigente: null` — la tarjeta se dibuja con el mapper que ya tienen.

| Código | Cuándo |
|---|---|
| `400 invalid_input` | `subject_type` ausente o fuera del enum. **No se puede crear una negociación sin materia** por esta ruta: esa la crea `POST /casos`, y una segunda sin materia dejaría dos filas que nada distingue. |
| `404 caso_not_found` | No es parte del caso, **o es el mediador**. Partir el caso en materias es un acto de parte, igual que `responder` y `renegociar`. |
| `409 negociacion_materia_already_exists` | El caso ya tiene esa materia. Código propio, no el `conflict` genérico. |
| `409 caso_no_negociable` | El caso está `terminado`, `cerrado`, `vencido` o `expirado`. |

**Dos cosas para el lado de ustedes:**

1. **Un caso `acordado` vuelve a `en_negociacion`** cuando se le agrega una materia, en la misma transacción del insert. Es el mismo efecto que ya manejan en renegociar, así que el `onCaseChanged` que la sección recibe cubre esto igual: el chip, el semáforo, el plazo y el botón de terminar cambian.
2. **La fila legacy sin materia se queda.** Después de dos altas el caso tiene **tres** negociaciones: la de `materia: null` (que ustedes dibujan como *"Sin materia asignada"*) más las dos nuevas. Es deliberado —`ronda_actual` de `GET /casos` se resuelve leyendo justamente esa fila— pero implica que **el caso no llega a `acordado` hasta que la legacy también esté firmada**, porque la derivación exige todas. Si al probar les molesta, el camino correcto es *asignarle* la materia a esa fila en vez de insertar una nueva; es un cambio con su propio diff y hay que decidir de dónde sale `ronda_actual` a nivel caso cuando ya no hay fila privilegiada. Díganos si lo quieren así y lo hacemos.

### 6.2 · `negotiationId` en propuestas

Dos rutas nuevas, con forma de recurso como `renegociar`:

```
POST /negociaciones/:negociacionId/propuestas   → PropuestaView
GET  /negociaciones/:negociacionId/propuestas   → PropuestaDetail[]
```

Mismos shapes y mismos códigos que las dos por caso, más `404 negociacion_not_found` cuando el id no existe (o no es de un caso del que sean parte). **Las dos por caso siguen andando** y siguen resolviendo la negociación sin materia, así que un caso que nunca se partió no tiene que cambiar de ruta.

Y **`negociacion_id` ahora viaja en el payload de la propuesta** (`PropuestaView` y `PropuestaDetail`). Con eso pueden agrupar por materia la lista por caso sin pedir una request por tarjeta — si el resumen de arriba les conviene mantenerlo en una sola llamada.

**El gate RN-05 del mediador pasa a ser por materia** en la ruta nueva: `GET /negociaciones/:id/propuestas` lee la ronda de *esa* negociación. Que tenencia llegue a ronda 3 no habilita al mediador a leer alimentos.

Con esto `getNegotiationEligibility` puede pasar a recibir `negociacion.estado`, que es el cambio de un parámetro que anotaron como suyo.

### 6.3 · Tres bugs que arreglamos de paso, porque la ruta de alta los volvía alcanzables

Los decimos porque cambian lo que van a ver al probar N materias, no para acumular mérito:

1. **`rondas` se buscaba por caso, no por negociación.** Con dos materias hay dos rondas número 1 (el unique es `(negociacion_id, numero)` desde la migración 41). La propuesta de una materia se habría insertado apuntando a la ronda de la otra, sin error y con los datos cruzados.
2. **Rechazar una propuesta movía la ronda de la fila legacy**, no la de la materia rechazada.
3. **`POST /casos/:casoId/acuerdo` podía redactar el borrador con el punto de encuentro de otra materia**: elegía bien la negociación pendiente pero leía la propuesta aceptada más reciente *del caso*.

### 6.4 · Lo que sigue sin poder verificarse, y lo que encontramos al intentar

- **Las posiciones se siguen leyendo por caso.** `items.negociacion_id` existe en el esquema pero **nada la escribe**: filtrar por materia hoy calcularía cada propuesta sobre un conjunto vacío. O sea: con dos materias abiertas, **las dos propuestas salen del mismo conjunto de items**. Partir las posiciones por materia va junto con la superficie de items.
- **El gate C-01 también aplica al reopen.** `trg_casos_gate_suscripciones` corre en cualquier transición a `en_negociacion`. Si las partes no tienen suscripción activa, **`POST /negociaciones/:id/renegociar` falla con `409 caso_bloqueado_suscripciones`** y rollbackea toda la renegociación — lo mismo el alta de una materia sobre un caso `acordado`. Con las partes al día funciona (lo verificamos contra Postgres real con una suscripción de verdad). Puede ser exactamente lo que el gate quiere, pero **ese 409 no tiene copy propio en el camino de renegociar** y hoy les cae en el error genérico con "reintentar", que no arregla nada.
- **Las 8 suites de integration rojas: ya sabemos por qué, y no es ambiguo.** Los 42 tests fallan todos con el mismo error, `Estado inicial inválido en INSERT`. La migración 44 hizo que la máquina de estados de `casos` corra también en INSERT y esas fixtures insertan casos directamente en `en_negociacion`/`acordado`/`cerrado`. El arreglo es mecánico; no entró acá porque son 8 archivos de otras historias.

---

*Cualquier cosa, respondemos sobre este doc.*
