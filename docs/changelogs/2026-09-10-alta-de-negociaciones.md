# Changelog — Proyecto Mediación

## 2026-09-10 (3) — Cómo nace la segunda negociación, y `negotiationId` en propuestas

**Origen:** los dos pedidos que Frontend dejó en `docs/pedidos-backend-a-frontend-acuerdos-modulares.md` §5 y en `docs/changelogs/2026-09-10-negociaciones-por-materia.md`. Toca sólo `apps/api` y `docs/`.

---

**`POST /casos/:casoId/negociaciones` — la ruta de alta que faltaba.**

Body `{ subject_type }`, una de las cuatro materias del enum. Devuelve el mismo `NegociacionView` que `GET /casos/:id/negociaciones`, así que la tarjeta nueva se dibuja con el mapper que ya existe: `acuerdo_vigente` viene `null`, `estado` `borrador`, `ronda_actual` 1.

**El `method` lo hereda del caso, no lo manda el cliente.** El método es una propiedad del caso que las partes acordaron; dejar que cada materia trajera el suyo pondría `negociaciones.method` en desacuerdo con `casos.metodo` sin ninguna regla que diga cuál gana.

**El mediador recibe 404, como en `responder` y en `renegociar`.** Partir el caso en materias es un acto de parte.

**Una materia repetida es `409 negociacion_materia_already_exists`, no el `conflict` genérico.** El insert va con `ON CONFLICT (caso_id, materia) DO NOTHING` sobre `negociaciones_caso_materia_unique`: bajo READ COMMITTED dos llamadas que agregan `tenencia` a la vez leen las dos "no está", y la que tiene que reconocerse duplicada es la segunda. Sin fila de vuelta = la materia ya estaba abierta.

**Y un caso `acordado` vuelve a `en_negociacion`, en la misma transacción.** *"Todas las negociaciones del caso están firmadas"* deja de ser verdad en el momento en que hay una más. Es el mismo `reopenFromAcordado` que usa `renegociar`, y es no-op en el caso normal (un caso que nunca estuvo acordado).

**Un caso `terminado`, `cerrado`, `vencido` o `expirado` responde `409 caso_no_negociable`.** Agregar una materia a un caso cerrado no tiene lectura de producto.

**La fila legacy con `materia = null` no se toca.** Después de dos altas el caso tiene tres negociaciones: la sin materia más las dos nuevas. Es aditivo a propósito —`withRondaActual()` resuelve `ronda_actual` de `GET /casos` leyendo justamente esa fila, y convertirla la dejaría en `null` con un tipo que dice `number`— pero tiene una consecuencia que conviene decir en voz alta: **el caso no llega a `acordado` hasta que la legacy también esté firmada**, porque la derivación exige todas. Ver "Lo que queda".

---

**`negotiationId` en las rutas de propuestas: dos rutas nuevas y una columna.**

- `POST /negociaciones/:negociacionId/propuestas`
- `GET /negociaciones/:negociacionId/propuestas`

Con forma de recurso, como `POST /negociaciones/:id/renegociar`. Las dos por caso siguen andando y siguen resolviendo la negociación sin materia: un caso que nunca se partió no tiene que cambiar de ruta.

**`propuestas.negociacion_id` ahora viaja en el payload**, agregado a `propuestaViewColumns` (el compile guard de `negociacion.types.spec.ts` lo verifica solo). Es lo que deja agrupar por materia la lista por caso sin pedir una request por tarjeta.

**El gate RN-05 del mediador pasa a ser por materia.** `GET /negociaciones/:id/propuestas` lee la ronda de *esa* negociación: que tenencia haya llegado a ronda 3 no dice nada sobre qué puede leer el mediador de alimentos.

---

**Tres bugs que sólo se volvían alcanzables con N > 1 — y que había que arreglar antes de entregar la ruta de alta.**

**1. `rondas` se buscaba por caso.** `buildFindByNumeroQuery(casoId, numero)`. La migración 41 cambió el unique de `rondas_caso_numero_unique` a `rondas_negociacion_numero_unique`, así que con dos materias abiertas hay **dos rondas número 1** y el caso ya no identifica ninguna. La propuesta de alimentos se habría insertado apuntando a la ronda de tenencia — sin violar ninguna constraint, sin error, con los datos cruzados. Ahora la query filtra por `negociacion_id` y hay un test que verifica que **no** menciona `caso_id`.

**2. Rechazar una propuesta movía la ronda de la negociación equivocada.** La rama de rechazo de `resolveRespuesta` resolvía la negociación con `buildActiveNegociacionQuery`, que filtra `materia is null`: rechazar en alimentos abría la ronda siguiente de la fila legacy. Ahora sale de la propuesta misma (`propuestas → negociaciones` por `negociacion_id`).

**3. `POST /casos/:casoId/acuerdo` podía redactar el borrador con el contenido de otra materia.** `generateAgreement` ya elegía bien la negociación pendiente, pero `readAcceptedPropuesta` leía *la propuesta aceptada más reciente del caso*. Con tenencia y alimentos acordadas, el borrador de una salía con el punto de encuentro de la otra. Ahora la lectura está scopeada a la negociación que se está materializando.

---

**Lo que no cambió, y por qué.**

**Las posiciones se siguen leyendo por caso.** `items.negociacion_id` existe en el esquema desde la migración 40, pero **nada la escribe**: `items.repository.ts` nunca la setea, así que filtrar por materia acá calcularía cada propuesta sobre un conjunto vacío de posiciones. Partir las posiciones por materia es el trabajo que va junto con la superficie de items, no antes. Está anotado en el código, no sólo acá.

---

### QA

- `pnpm typecheck` — limpio.
- `pnpm biome ci .` — limpio (los 7 warnings son los mismos que trae `dev`; verificado con el árbol sin cambios).
- `pnpm jest` sin base — **151 suites, 1350 tests**, 0 fallas.
- `pnpm jest` **contra Postgres real** (`supabase start` local, migraciones al día) — el spec nuevo `negociaciones-alta.integration.spec.ts` pasa **8/8**.

**Lo que ese spec prueba, que ningún fake puede:** que un caso creado por el camino de producción arranca con exactamente una negociación sin materia; que dos `crear` lo llevan a tres, en orden de `created_at`; que la materia repetida es 409 y **deja una sola fila**; que un caso `acordado` vuelve a `en_negociacion` y uno que no lo estaba queda igual; que `ronda_actual` de `GET /casos` sigue resolviendo; que **cada materia tiene su propia ronda 1** y `findByNumero` devuelve la correcta; y que mover la ronda de una no toca la de la otra.

O sea: **"N materias" ya se puede producir en un entorno.** Era el pedido 1.

**Dos cosas que aparecieron al correr integration, dichas sin adornos:**

- **Las 8 suites de integration que estaban rojas siguen rojas, y ahora sabemos exactamente por qué.** No es "los seeds contra la migración 44" en general: son 42 tests, y **todos** fallan con el mismo error de Postgres, `Estado inicial inválido en INSERT: <estado>`. La migración 44 (`20260909130000_casos_estado_insert_guard.sql`) hizo que `validate_caso_estado_transition` corra también en INSERT, y esas fixtures insertan `casos` directamente en `en_negociacion`/`acordado`/`cerrado`. El arreglo es mecánico y uniforme: caminar la máquina de estados. **No lo hicimos en este PR** — son 8 archivos de otras historias y merecen su propio diff. Las suites: `renegociacion`, `negociacion-rondas`, `negociacion-noleak`, `acuerdos-generation`, `acuerdos-firmar`, `caso-acordado-derivado`, `docusign-webhook`, `signnow-webhook`.
- **El gate C-01 también aplica al reopen.** `trg_casos_gate_suscripciones` corre en cualquier `UPDATE OF estado` hacia `en_negociacion`, así que si las partes no tienen suscripción activa, tanto el alta de una materia sobre un caso `acordado` como **`POST /negociaciones/:id/renegociar`** fallan con `caso_bloqueado_suscripciones` y rollbackean toda la transacción. Con las partes al día pasa (el spec nuevo lo verifica con una suscripción real). Puede ser exactamente lo que el gate quiere; lo dejamos como está porque debilitar un gate de facturación no es una decisión de este PR, pero **Frontend no tiene copy para ese 409 en el camino de renegociar**.

---

### Lo que queda

- **La fila legacy sin materia.** Un caso partido en materias arrastra la negociación sin materia, y la derivación de `acordado` la exige firmada como a cualquier otra. Lo correcto de producto sería *asignarle* la materia a esa fila en la primera alta en vez de insertar una nueva — pero eso rompe `withRondaActual()` y `buildActiveNegociacionQuery()`, que hoy identifican "la negociación del caso" por `materia is null`. Es un cambio con su propio diff, y hay que decidir de dónde sale `ronda_actual` a nivel caso cuando ya no hay una fila privilegiada.
- **Posiciones por materia** (`items.negociacion_id`), arriba.
- **Las 8 suites de integration**, arriba.
