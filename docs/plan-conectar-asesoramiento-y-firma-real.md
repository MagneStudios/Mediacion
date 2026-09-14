# Plan — Conectar asesoramiento legal y firma real (SignNow) al backend

**Fecha:** 14/09/2026 · **Autor:** Frontend (con Claude Code)

## Contexto

De los 12 puntos de `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` sin cerrar, dos tienen la particularidad de que **el backend ya está construido** y lo único que falta es la conexión del lado del frontend — el resto necesita trabajo de backend/DB o está bloqueado por decisiones del cliente.

**Corrección importante sobre el alcance de la parte B:** en el diagnóstico inicial afirmé que conectar la firma real (SignNow) era "100% frontend, sin depender de nadie". Al explorar el contrato real de backend en profundidad, eso resultó ser **incompleto**: el modelo que SignNow ya implementa es firma **por email, fuera de la app** (SignNow le manda la invitación al firmante directo; no hay URL de firma embebida que el backend entregue). Conectar la pantalla actual "tal cual está" al backend real no solo no alcanza — **rompe un flujo que hoy funciona por accidente**, porque hay una doble llamada a `POST /acuerdos/:id/firmar` que el backend ya rechaza con `409` en su segunda invocación (probado en `acuerdos-firmar.integration.spec.ts:265`), simplemente nadie lo nota porque el mock tapa la pantalla real.

Se decidió (14/09) el alcance mínimo y seguro para la parte B: arreglar el bug y rediseñar la pantalla para reflejar el modelo real de backend (firma por mail, con estado por firmante) — **sin pedir un endpoint nuevo** de firma embebida en la app. Eso queda anotado como pregunta de producto abierta, no como parte de este plan.

---

## A. Asesoramiento personal — conectar `lawyer.service.ts` al backend real

### Qué existe en backend y no se consume

- `POST /casos/:casoId/solicitud-abogado` → crea/reutiliza la solicitud pendiente y arma el checkout de Mercado Pago (`apps/api/src/abogado/abogado.controller.ts:23-29`, `abogado.service.ts:68-87`). Devuelve `SolicitudAbogadoCheckout = { solicitud, init_point }`.
- `GET /casos/:casoId/solicitud-abogado` → la solicitud más reciente del caso (`abogado.controller.ts:31-37`, `abogado.service.ts:89-99`). `404 solicitud_abogado_not_found` si no hay ninguna.
- El pago se confirma solo, por el webhook de Mercado Pago (`payment-router.service.ts` → `abogado.service.ts:107-119`) — **el frontend no tiene que disparar ni simular nada de esto**.
- `LAWYER_FEE_ARS_MINOR` en `apps/api/src/config/config.ts:74,338-342` — ya coincide con el mock (`5_000_000` = ARS 50.000).

### Qué falta del lado frontend

1. **Nuevos archivos de transporte**, siguiendo el mismo patrón de tres capas que `cases.api-service.ts` / `cases.backed-service.ts`:
   - `mediacion-app/services/api/lawyer.api-service.ts` — `ApiSolicitudAbogadoView` (`id, caso_id, status, moneda, monto_minor, external_reference, paid_at, created_at`) y `ApiSolicitudAbogadoCheckout` (`{ solicitud, init_point }`), con mapper a los tipos de dominio de `types/lawyer.ts` (`LawyerRequest`: componer `fee` desde `moneda`+`monto_minor`).
   - `mediacion-app/services/api/lawyer.backed-service.ts` — implementa `LawyerService` contra la API real.
2. **Registrar el dominio en el switch mock/backend**: agregar `lawyer: createApiLawyerService(http)` a `Backend` y a `createBackend(...)` en `mediacion-app/services/api/backend.ts:21-50,80-118`, y en `mediacion-app/services/lawyer.service.ts:156` cambiar el singleton a `backend ? createBackedLawyerService(backend.lawyer) : createMockLawyerService()` (mismo patrón que `services/cases.service.ts:340-342`).
3. **Nuevo código de error**: agregar `codeSolicitudAbogadoNotFound = 'solicitud_abogado_not_found'` a `mediacion-app/services/api/api-error.ts` (falta hoy).
4. **`getOffer()` no tiene contraparte real** — el backend no tiene ningún endpoint ni columna para `scope`/`responseHours`. El backed-service debe devolver siempre `{ scope: null, responseHours: null }`, igual que el mock hoy. Esto **no es un workaround temporal a resolver acá** — es honestidad con el estado real: el botón de confirmar sigue bloqueado (`canPay` en `LawyerRequestButton.tsx:91`) hasta que el estudio defina el alcance del servicio (pedido #1 de `docs/respuestas-cliente-01-09-2026.md`, marcado bloqueante para publicar). **No proponer resolver esta decisión de negocio en esta implementación.**
5. **`handoff.estudioWhatsapp` tampoco viaja del backend** — el backed-service debe dejar `handoff: null` (o el campo que corresponda), confiando en que `LawyerHandoffCard.tsx:44` ya hace fallback a `EXPO_PUBLIC_ESTUDIO_WHATSAPP` cuando el payload no lo trae. Sin cambios ahí.
6. **`EstadoSolicitudAbogado` del frontend tiene 4 valores que el backend no puede emitir** (`notificada`, `asignada`, `cerrada`, `reembolsada` — el backend solo tiene `pendiente_pago | pagada | fallida`). El mapper debe tipar el resultado sobre el enum real de 3 valores; no inventar los otros cuatro ni intentar derivarlos.
7. **Sacar `simulatePaymentConfirmation` de la UI cuando hay backend real.** Es una afordancia de demo (`lawyer.service.ts:31-40`) que no tiene sentido con un webhook real confirmando el pago. En `features/lawyer/components/LawyerSection.tsx`, gatear el botón de "simular pago" a `!isBackendLive` (mismo flag de `services/backend-instance.ts:35` que ya se usa en otras pantallas de demo), y que `getRequest`/`useLawyerRequest.ts` haga refetch en foco (mismo patrón de `useAgreement.ts`) para reflejar el pago real cuando vuelva del checkout de Mercado Pago.
8. **`init_point` del checkout**: no hay hoy ningún flujo de "abrir Mercado Pago y volver" en `features/lawyer/*` (a diferencia de `app/profile/plan/checkout.tsx`, que sí lo tiene). Replicar ese mismo patrón: `Linking.openURL(init_point)` al confirmar, y refetch de `getRequest` al volver a foco.

### Tests a agregar/actualizar

- `mediacion-app/services/api/__tests__/lawyer.api-service.test.ts` (nuevo) — mapeo `ApiSolicitudAbogadoView` → `LawyerRequest`, y `ApiSolicitudAbogadoCheckout` → lo que consuma la UI.
- `mediacion-app/services/api/__tests__/lawyer.backed-service.test.ts` (nuevo) — `getOffer()` siempre `{scope: null, responseHours: null}`; `getRequest` propaga `404 solicitud_abogado_not_found` como "sin solicitud" (no como error); `requestLawyer` arma el `init_point` correctamente.
- `LawyerRequestButton.test.tsx` / `LawyerHandoffCard.test.tsx`: no deberían necesitar cambios (mockean `lawyer.service` completo, contrato de interfaz sin tocar), pero correrlos para confirmar.
- Actualizar/crear test de `LawyerSection.tsx` que confirme que el botón de simular pago no aparece con `isBackendLive`.

---

## B. Firma real (SignNow) — arreglar el bug y reflejar el modelo real

### El problema exacto

- `sendToSignature` (`POST /acuerdos/:id/firmar`) es la única acción de firma que existe en backend — envía el documento a **todos** los firmantes de una vez vía SignNow (`apps/api/src/acuerdos/acuerdos.service.ts:182-215`), que le manda un mail de invitación a cada uno (`http-signnow-client.ts:132-148`, "freeform invite"). **No hay concepto de "mi firma individual" en el backend, ni una URL de firma que la app pueda abrir.**
- Esa llamada ya la dispara `prepareSignatureDocument` (`agreements.backed-service.ts:115-132`) la primera vez que alguien prepara el documento — es lo que pasa el acuerdo de `borrador` a `enviado_a_firma`.
- La pantalla de firma (`app/case/[id]/agreement/sign.tsx`) hoy vuelve a llamar a la misma acción vía `submitOwnMockSignature` → `sendToSignature` (`agreements.backed-service.ts:134-140`) cuando el usuario toca "Confirmar firma". Como el acuerdo ya no está en `borrador` a esa altura, el backend real respondería **409 `acuerdo_not_borrador`** — probado explícitamente en `acuerdos-firmar.integration.spec.ts:265`. Hoy nadie lo ve romperse porque `MockSignatureConfirmation` reemplaza toda esa lógica por un mock in-memory.

### Qué SÍ está bien y no hay que tocar

- La lectura de acuerdo, firmas y bandeja **ya está conectada al backend real** (`agreements.backed-service.ts` / `agreements.api-service.ts`) — solo la semántica de "firmar" está mal modelada.
- `FirmaView`/`SignatureInboxEntry` ya traen estado por firmante (`docusign_status`, `pending_signers`) — la pantalla puede mostrar "a la espera de que fulano firme por mail" sin pedir nada nuevo a backend.
- El refetch en foco ya existe en `useAgreement.ts:118-123` — reusar ese mecanismo para reflejar cuando el webhook de SignNow actualice el estado.

### Qué hay que cambiar

1. **Sacar la doble llamada.** Eliminar `submitOwnMockSignature` del contrato `AgreementsService` (mock y backed) y de lo que expone `useAgreement.ts` (`submitSignature`/`signStatus`). El único disparador de `sendToSignature` sigue siendo `prepareSignatureDocument`, sin cambios.
2. **Rediseñar `sign.tsx`**: cuando `state.agreement.estado === 'enviado_a_firma'` (el gate `canSign` que ya existe en `agreement-mapper.ts:143`), dejar de mostrar el checkbox + botón "Confirmar firma" y mostrar en cambio una vista de **estado**: "Se envió una invitación por mail a cada parte" + la lista de firmantes con su estado (`FirmaView`), con un botón de refrescar (o el refetch en foco que ya existe).
3. **Eliminar `MockSignatureConfirmation.tsx`** — deja de tener sentido una vez que la pantalla es de solo-estado, tanto contra backend real como contra el mock (mismo criterio que se usó para sacar `simulatePaymentConfirmation` de asesoramiento: una afordancia de demo no convive con el flujo real, se reemplaza entera).
4. **Actualizar `SignatureEnvironmentNotice.tsx`**: el texto actual ("entorno de prueba / firma simulada") ya no es cierto una vez conectado. **Copy provisorio, no definitivo** — como con cualquier disclaimer legal de esta app, el texto final necesita revisión del estudio (mismo criterio que el punto 11 de `CAMBIOS-PACTUM-v2`, "que legales apruebe la redacción final"). Para este plan: reemplazar por algo honesto y neutro ("vas a recibir un mail de SignNow para firmar; esta pantalla se actualiza sola cuando todas las partes firmaron") y marcarlo explícitamente como pendiente de revisión legal en el propio commit/PR.
5. **i18n**: dar de baja o repropósito las claves `agreement.sign.*` relacionadas a "firma simulada" (`i18n/locales/es-AR.json:140,150,167,178,179,182,185,192,196,215` y sus pares en `en.json`), agregar las nuevas de estado/espera.
6. **Mock**: el servicio mock (`services/agreements.service.ts`, cuando no hay backend configurado) debería simplificarse al mismo modelo de solo-estado, para que la demo se vea igual que producción — no mantener un camino de firma en un click en paralelo.

### Lo que este plan deliberadamente NO resuelve (preguntas de producto abiertas)

- **¿Se quiere a futuro firma embebida dentro de la app** (WebView/URL de firma por firmante), en vez de depender del mail de SignNow? Eso requiere un endpoint nuevo de backend que hoy no existe — está fuera del alcance acordado (14/09) para este plan.
- **¿Quién puede disparar un reenvío de invitación** si el firmante perdió el mail? No existe ese endpoint hoy.
- **Copy legal definitivo** del nuevo disclaimer — necesita aprobación del estudio, no es una decisión de ingeniería.
- **Destino de `docusign-webhook.controller.ts`** (ruta legacy que sigue registrada pero sin proveedor activo) — es decisión de backend, no bloquea nada de este plan.

### Tests a actualizar

- `app/case/[id]/agreement/__tests__/sign.test.tsx` — reescribir para el nuevo diseño de pantalla (estado por firmante, sin acción de "confirmar").
- Eliminar `MockSignatureConfirmation.test.tsx` si existe standalone.
- `services/api/__tests__/agreements.backed-service.test.ts:118-120,138,152` — sacar los tests que verifican `submitOwnMockSignature → sendToSignature` (ese método deja de existir); agregar un test que confirme que **no** hay ninguna llamada a `sendToSignature` disparada desde la pantalla de firma una vez que el acuerdo ya está `enviado_a_firma` (para no reintroducir el 409 a futuro).
- Si hay un test de integración (`acuerdos-firmar.integration.spec.ts`) del lado backend que ya prueba el 409 — no tocarlo, es la prueba de que el fix del lado frontend es necesario.

---

## Verificación end-to-end

1. `pnpm typecheck` y `pnpm --filter mediacion-app test` después de cada sección.
2. **Asesoramiento**: probar contra un backend real (o `supabase start` local) el flujo completo — pedir abogado, ver `init_point`, confirmar que `getOffer()` sigue bloqueando el botón de pago (`scope: null` es el estado correcto hoy, no un bug), y que el webhook de Mercado Pago actualiza el estado sin que la app tenga que simular nada.
3. **Firma real**: contra un backend real, generar un acuerdo, prepararlo para firma, y confirmar que la pantalla ya NO ofrece un botón que dispare un segundo `POST /acuerdos/:id/firmar` (el bug que se corrige). Si es posible, provocar el 409 manualmente contra un entorno de prueba para confirmar que el nuevo diseño de pantalla nunca lo dispara.
4. Revisar visualmente ambas pantallas (asesoramiento y firma) en el simulador/browser para confirmar que el estado "bloqueado hasta que el estudio decida" (asesoramiento) y "esperando firma por mail" (firma real) se leen bien y no prometen algo que la app no hace.
