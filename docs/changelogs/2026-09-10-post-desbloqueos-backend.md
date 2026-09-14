# Changelog — Proyecto Mediación

## 2026-09-10 (5) — Los cuatro desbloqueos de los commits directos de Backend

**Origen:** `c029d02` y `e8eeec4`, dos commits que Backend pusheó directo a `dev` después de nuestro merge de ayer, sin PR. Resuelven los dos pedidos que le dejamos en su doc §5 y dos pedidos viejos de DB. Toca sólo `mediacion-app` y `docs/`.

---

### 1 · `pago_a_cargo` deja de fingirse

`InvitacionCreated` (POST) e `InvitacionView` (GET) ya traen `pago_a_cargo` de verdad desde hoy. El workaround que veníamos arrastrando desde el 25/08 —un mapa en memoria en `cases.backed-service.ts` que le pegaba el valor a la respuesta del GET porque ese endpoint nunca lo seleccionaba— se borró entero: `getInvitation` es un `find` sobre lo que el servidor devuelve, sin nada más.

**`null` cambia de significado, y el tipo no cambia por eso.** Antes, `null` en `CaseInvitation.pagoACargo` sólo podía significar "el servidor todavía no lo manda". Ahora puede ser una respuesta real y legítima —la columna es nullable, y una invitación sin definir quién paga sigue siendo válida—, así que el tipo se queda `PagoACargo | null` de todos modos: dejó de ser un hueco que tapábamos, y pasó a ser un valor real que el servidor puede devolver.

### 2 · Copy para el 409 del gate C-01 en renegociar

Bruno avisó en su changelog de ayer que `POST /negociaciones/:id/renegociar` también puede fallar con `caso_bloqueado_suscripciones` si alguna parte no tiene suscripción activa, y que el front no tenía mensaje para ese caso. `NegotiationMateriaCard` ya tenía el patrón para esto —`isSubscriptionRequiredError`, el mismo que usa `join.tsx`—; sólo faltaba aplicarlo acá. A diferencia de `notAcordada` (donde la otra parte ya renegoció y hay algo que releer), acá la transacción entera hizo rollback: no se relee nada.

### 3 · Agregar una materia, desde la UI

*"El usuario tiene que poder abrir una negociación nueva sobre otra materia dentro del mismo caso, sin arrancar un caso nuevo"* — requisito de cliente explícito desde el 01/09, sin ruta de alta hasta hoy. `POST /casos/:casoId/negociaciones` ya existe: body `{ subject_type }`, `metodo` heredado del caso, y devuelve el mismo `NegociacionView` que ya mapeábamos.

**`AddMateriaCard`**, nueva, mismo patrón que `CaseDeadlineCard`: acción directa, sin diálogo (agregar una materia no es destructivo), un botón por cada materia todavía no usada en el caso. Si las cuatro están abiertas, la tarjeta no se dibuja — no hay nada que ofrecer. `canAddMateria` en `case-actions.ts` espeja `estadosCasoNegociables` del servidor: **`pendiente_suscripciones` queda afuera a propósito**, mismo criterio que el resto de las utils de elegibilidad — es el gate C-01, y la otra parte está impedida de actuar.

### 4 · Cada materia tiene su propia negociación

`negotiationId` ya existe en las rutas de propuestas (`POST/GET /negociaciones/:negociacionId/propuestas`, gemelas de las de por caso), así que una materia dejó de compartir la ronda de la legacy. `useNegotiation`/`useRoundHistory`/las pantallas de negociación e historial ganaron un `negotiationId?` opcional, mismo patrón que `useAgreement(caseId, agreementId?)` de ayer. `NegotiationMateriaCard` suma "Ver negociación" — **sólo cuando `subjectType !== null`**: la legacy sigue entrando por `NegotiationSummaryCard`, que ya resuelve bien "la negociación sin materia", y duplicar la entrada ahí sería confuso, no una mejora.

**El estado de una negociación se deja de derivar del estado del caso.** Antes había una sola negociación posible por caso, así que `casos.estado → negociaciones.estado` era una traducción trivialmente correcta. Con una segunda materia deja de serlo: el estado de cada negociación se deriva ahora de **su propia ronda y propuesta** — sin ronda es `borrador`, con una ronda activa es `activa`, con la propuesta aceptada es `acordada`. Es también más fiel a la API real: Backend nunca escribe `cerrada`/`terminada` (terminar un caso no termina sus materias todavía), así que un caso terminado con una ronda activa sigue mostrando esa ronda en vez de una transición que el servidor tampoco hace.

**`acordado` deja de dispararse con la primera materia que acepta.** `markCaseAsAgreed` ahora comprueba que **todas** las negociaciones del caso —legacy y materias— tengan su propia propuesta aceptada antes de mover el caso entero a `acordado`. Antes de esta tanda esto era trivialmente cierto (una sola negociación posible); con una segunda materia dejó de serlo, y sin este chequeo aceptar tenencia habría apagado alimentos.

**Una materia recién creada ya vale `Ronda 1`, no `Ronda 0`.** `negociaciones.round` es `INT NOT NULL DEFAULT 1`, y `POST /casos/:casoId/negociaciones` no inserta ninguna fila en `rondas` — así que el valor por default ya es 1 antes de que exista una ronda real. La primera versión de `computeNegotiation` caía a `0` cuando no había ronda, que habría sido un valor que la columna real nunca tiene.

**Corrección respecto a lo que dijimos ayer.** El changelog de ayer prometía que `getNegotiationEligibility` iba a pasar a recibir `negociacion.estado` en vez de `casos.estado`. Verificado hoy contra el código de Backend (`negociacion.service.ts`, comentario del propio autor): **las posiciones se siguen leyendo por caso**, no por materia — `items.negociacion_id` existe en el esquema pero nada lo escribe. O sea que "¿hay contraparte?", "¿están las posiciones completas?" y el gate C-01 siguen siendo hechos del caso, no de la materia: cambiar el parámetro habría sido incorrecto, no sólo prematuro. La función **no cambió de firma** — lo que cambió es de dónde salen `currentRound`/`currentProposal`, que ahora sí son por negociación.

---

### Un límite que queda documentado, no resuelto

**El mock no puede materializar un acuerdo propio para una segunda materia.** `mock-agreement-store.ts` modela un acuerdo por caso, no por negociación — limitación que ya documentamos ayer. Para que la legacy siga materializando bien el suyo, la búsqueda de "la propuesta aceptada que hay que convertir en acuerdo" quedó explícitamente scopeada a la negociación legacy (`legacyAcceptedProposal`), y no a cualquier propuesta aceptada del caso — sin este scope, aceptar la propuesta de una materia nueva podría materializar un acuerdo con el contenido equivocado.

**Contra la API real esto no aplica.** `POST /casos/:casoId/acuerdo` ya resuelve la negociación correcta desde el fix de Bruno (`readAcceptedPropuesta` scopeado a la negociación que se está materializando) — el límite es sólo del store de acuerdos del mock, y arreglarlo bien es su propio diff, no algo para agregar de apuro acá.

---

### QA

- `npx tsc --noEmit` — 0 errores.
- `npx jest` — **146/146 suites, 1317/1317 tests** (30 nuevos).
- `npx expo lint` — limpio.
- **En el navegador, contra el mock:** en case-1 (`en_negociacion`, sin materias todavía), "Agregar materia" → "Alimentos" crea la negociación (`Borrador · Ronda 1` — `negociaciones.round DEFAULT 1`, ninguna ronda creada todavía) sin tocar la legacy (`Activa · Ronda 2`), y el botón deja de ofrecer "Alimentos"; "Ver negociación" navega a `/case/case-1/negotiation?negotiationId=...` y la pantalla carga bien, mostrando "Faltan tus posiciones" para la materia nueva. En case-3 (acordado, con acuerdo firmado), renegociar sigue funcionando exactamente igual que ayer: el caso vuelve a "En revisión", la legacy pasa a `Activa · Ronda 2 · Acuerdo v2 · En preparación`, y "Agregar materia" también aparece (un caso `acordado` es negociable). Cero errores de consola en los dos casos.

**Lo que no se pudo verificar:** generar y aceptar una propuesta completa para una segunda materia requiere cargar posiciones privadas primero (mismo flujo que la legacy) — no se ejercitó de punta a punta en el navegador esta vez, pero está cubierto por tests unitarios (aislamiento de ronda/propuesta por `negotiationId`, `allNegotiationsAccepted` antes de mover el caso a `acordado`).

---

### Lo que queda

- **Posiciones por materia** (`items.negociacion_id` existe, nada lo escribe) — de Backend, ya documentado ayer.
- **El store de acuerdos del mock, por negociación** — para que una segunda materia también pueda materializar su propio acuerdo en el mock. No bloquea la API real.
- **`negociaciones.estado` nunca llega a `cerrada`/`terminada`** — decisión de producto pendiente, según el propio changelog de Backend de hoy.
