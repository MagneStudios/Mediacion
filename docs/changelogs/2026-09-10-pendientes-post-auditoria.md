# Changelog — Proyecto Mediación

## 2026-09-10 (4) — Los dos pedidos de DB que quedaban, y la primera corrida de integration entera en verde

**Origen:** `docs/pedidos-db-post-auditoria-09-09.md` §«Pedido a Backend», puntos **4** y **3**. Toca sólo `apps/api` y `docs/`.

De los seis pedidos de ese doc, cuatro ya estaban (el 1 y el 5 salieron con acuerdos modulares, el 6 con `acordado` derivado, el 2 el 09/09). Éstos son los dos que faltaban — y, de yapa, lo que hizo falta para poder comprobarlos.

---

**4 · Una materia que está negociando ya no figura `borrador`.**

`negociaciones.estado` existe desde la migración 40 y **nunca salía de su default**. Los únicos dos writes eran `acordada` (al aceptarse la propuesta) y `activa` (sólo desde `renegociar`). O sea: una negociación con rondas, propuestas y respuestas seguía diciendo `borrador`, y la tarjeta por materia que el front dibujó el 10/09 mostraba *"Borrador"* para algo vivo.

Ahora se activa **en el mismo momento en que el caso pasa a `en_negociacion`**: al generarse la primera propuesta de esa materia. No en el alta —una materia recién creada, sin items ni propuestas, es exactamente lo que `borrador` describe— y no por un trigger: es la misma decisión que ya toma `activateNegotiation`, tomada en el mismo lugar.

**El UPDATE está guardado en `borrador`.** Es idempotente, y una materia ya `acordada` que recibe otra propuesta no puede volver atrás por este camino: para eso está `renegociar`, que sí es explícito y hace cinco cosas más. Verificado contra la base, incluido el caso de la marcha atrás que no ocurre.

**Lo que esto desbloquea del lado del front:** `getNegotiationEligibility` ya tiene la fuente por materia que `negociaciones.estado` prometía. Hasta ahora leer esa columna habría dado `borrador` para todo.

**Lo que no hicimos, a propósito:** `cerrada` y `terminada` siguen sin escribirse nunca. Terminar un caso no termina sus materias hoy, y decidir si debería es producto, no backend. DB pidió el `activa`; el resto no está pedido.

---

**3 · `pago_a_cargo` deja de ser una columna que nadie escribe.**

Estaba en el esquema desde la 20260810120000 (R-07) con un `CHECK (pago_a_cargo IN ('invitador','invitado'))`, y `apps/api` no la mencionaba en ningún archivo: ni se persistía en `POST /casos/:id/invitaciones` ni salía en `GET /casos/:id/invitaciones`.

Ahora entra por el body (opcional), se persiste, y viaja tanto en la respuesta del alta como en la lista.

**Es opcional de verdad.** La columna es nullable y `NULL IN (...)` no es `FALSE`, así que el `CHECK` deja pasar NULL: una invitación sin definir quién paga sigue siendo válida — el gate C-01 se resuelve después, cuando cada parte contrata.

**Un valor fuera del `CHECK` es `400 invalid_input`, no un `409 conflict`.** Dejar que lo rechace la base convierte el único error que el cliente puede arreglar en un conflicto genérico que no nombra el campo.

**El tipo no se deriva del esquema, y es la excepción.** `pago_a_cargo` es `TEXT` con `CHECK`, no un enum de Postgres, así que `Invitacion["pago_a_cargo"]` es `string | null` y no hay de dónde sacar el dominio. `valoresPagoACargo` en `invitaciones.types.ts` es la copia de ese `CHECK` y el único lugar donde vive. No hay compile guard posible acá — sí hay un test de integración que comprueba que la base rechaza lo que el servicio filtra.

---

**Y lo que hizo falta para poder comprobar cualquiera de las dos: integration estaba entera rota.**

Ocho suites, 42 tests, **todos con el mismo error de Postgres**: `Estado inicial inválido en INSERT`. La migración 44 (`20260909130000_casos_estado_insert_guard.sql`) hizo que `validate_caso_estado_transition` corra también en INSERT, aceptando sólo `nuevo` o `pendiente_suscripciones`, y esas fixtures insertaban `casos` directo en `en_negociacion`, `acordado` o `cerrado`. Está rojo desde el 09/09 y **es invisible sin `DATABASE_URL`**: sin base, jest las saltea y reporta verde.

En vez de nueve parches iguales hay **un helper**, `casos/caso-estado.fixture.ts`: inserta el caso en `nuevo` y camina la máquina de estados hasta donde la fixture lo quiera. El próximo cambio de la máquina se arregla en un lugar. Va excluido del build (`tsconfig.build.json` ahora ignora `src/**/*.fixture.ts` además de los specs), así que no viaja a `dist`.

**Hay un orden que el helper documenta y que no es opcional:** llamarlo **antes** de insertar `caso_partes`. Los saltos a `activo` y `en_negociacion` los mira `trg_casos_gate_suscripciones`, que sólo deja pasar un caso sin partes o uno donde todas tienen suscripción activa. Con la parte enganchada y sin suscripción, el gate levanta `caso_bloqueado_suscripciones` y la fixture muere por otra razón distinta.

**Y arreglar eso destapó tres tests que estaban mal desde el PR anterior.** `negociacion-rondas.integration.spec.ts` seguía llamando `rondasRepository.findByNumero(casoId, n)` con la firma vieja; desde que la query pasó a filtrar por `negociacion_id` devolvía `undefined`. Nadie lo vio porque la suite ya estaba roja por la migración 44 — exactamente el modo de falla que la nota del `estado.md` de Soriano llama «un centinela que nadie corre».

---

### QA

- `pnpm typecheck` — limpio.
- `pnpm biome ci .` — los mismos 7 warnings que trae `dev`, ninguno nuevo.
- `pnpm jest` sin base — **151 suites, 1354 tests**, 0 fallas.
- `pnpm jest` **contra Postgres real** (`supabase db reset`, migraciones al día) — **176 suites, 1486 tests, 0 fallas, 0 skipped.** Es la **primera corrida entera en verde** de integration desde la migración 44.

Lo que se comprueba contra la base y no contra un fake:

- La materia pasa de `borrador` a `activa` al generarse su primera propuesta, y **no vuelve** desde `acordada`.
- `pago_a_cargo` se persiste, sale en la lista, acepta NULL, y **el `CHECK` real rechaza** un valor de más — lo mismo que el servicio filtra con un 400.
- Las ocho suites que estaban rojas.

---

### Lo que queda

- **`negociaciones.estado` nunca llega a `cerrada` ni `terminada`.** Arriba: falta decisión de producto.
- **Posiciones por materia** (`items.negociacion_id` existe y nada la escribe), del PR anterior.
- **La fila legacy sin materia**, del PR anterior.
- **El gate C-01 aplica al reopen**, del PR anterior: `renegociar` falla con `caso_bloqueado_suscripciones` si las partes no están al día, y el front no tiene copy para ese 409.
