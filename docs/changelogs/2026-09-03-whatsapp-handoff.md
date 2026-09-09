# Changelog — Proyecto Mediación

## 2026-09-03 (cont.) — Handoff por WhatsApp post-pago, contra el mock

**Origen:** `docs/respuestas-cliente-01-09-2026.md` §2.4 y §8, ítem 5. Era el único pendiente de FE que quedaba en esta rama; el número real del estudio sigue sin llegar (confirmado también contra el PDF fuente, `pactum_respuestas_cliente.pdf` — no trae ningún teléfono).

---

**Lo que entra: la pantalla, construida entera contra el mock, con el número ausente modelado como el estado real que es.**

`utils/whatsapp-handoff.ts` — el único lugar que arma la URL de `wa.me`, y el que hace cumplir la restricción del spec §7.5: *"nunca datos sensibles de la negociación en la URL de `wa.me`, sólo un identificador corto"*. No es una convención de comentario, es código: `buildHandoffUrl` recibe una plantilla ya traducida más un `code`, valida el código con `isSafeHandoffCode` (`^[A-Za-z0-9-]{1,32}$`) y devuelve `null` si el mensaje no lo contiene. No hay forma de pasarle el objeto del caso o el nombre de la contraparte sin que el test lo rechace.

`types/lawyer.ts` — `LawyerRequest.handoff: LawyerHandoff | null`, con `estudioWhatsapp` y `codigo`. Es la mitad del contrato con BE que **sí se puede congelar hoy**, aunque el resto de la ficha del endpoint siga abierta (`docs/plan-frontend-monetizacion.md` §4.4): el alcance del servicio cambia qué campos necesita el modal, pero no cambia qué necesita el handoff.

`config/env.ts` + `config/env-source.ts` — `EXPO_PUBLIC_ESTUDIO_WHATSAPP`, opcional a propósito. A diferencia de `readAppEnv`, que tira si falta Supabase, este lector nunca tira: el número es un dato de Administración que todavía no llegó, y no arranca la app por eso sería castigar todo el producto por una pantalla. El payload de BE, cuando exista, gana sobre esta variable.

`features/lawyer/components/LawyerHandoffCard.tsx` — la tarjeta. Con número: botón "Abrir WhatsApp" vía `Linking.openURL`; sin WhatsApp instalado, cae a mostrar el número con copiar (mismo componente `InvitationResultCard` que ya usa el código de invitación). **Sin número** — el caso de hoy — dice explícitamente que falta el dato y muestra el código de la solicitud para que la persona lo guarde. Mismo criterio que el alcance pendiente del modal de contratación y que los `[COMPLETAR]` de los textos legales: el bloqueo se ve.

`features/lawyer/components/LawyerSection.tsx` — decide cuál de las dos cosas mostrar (contratar o coordinar) según el estado de la solicitud, para que `LawyerRequestButton` no tenga que saber que el handoff existe. Reemplaza al botón pelado en `CaseDetailScreen.tsx`.

**El atajo de demo, y por qué hace falta uno.** No hay checkout de Mercado Pago ni webhook (§7.4 es de BE), así que sin algo que mueva la solicitud de `pendiente_pago` a `pagada` la pantalla de handoff no es alcanzable desde la UI. `lawyerService.simulatePaymentConfirmation` lo hace, rotulado como demo — mismo criterio que `SimulateInvitationAcceptanceDialog` y que el bypass de `payment-required.tsx`. Se cae junto con el resto del mock cuando el webhook exista.

**Lo que no se construyó, porque no es de acá.** El respaldo por email al estudio (§7.5: *"en paralelo, siempre enviar un email... si falla WhatsApp, el email garantiza que el caso pagado no se pierde"*) es de BE. Con el handoff manual ese respaldo importa más, no menos.

---

### QA

- `npx tsc --noEmit` — sin errores nuevos (los 4 preexistentes de `dev` siguen igual).
- `npx jest` — **131/131 suites, 1149/1149 tests**. Nuevos: `whatsapp-handoff.test.ts` (la restricción de datos sensibles, probada en el borde), `LawyerHandoffCard.test.tsx` (abre wa.me, cae a copiar, oculta el botón sin número), `LawyerSection.test.tsx` (contratar vs. handoff según estado, el atajo de demo).
- `npx expo lint` — limpio.
- Paridad de i18n verificada entre `es-AR.json` y `en.json`: mismas claves en ambos.
