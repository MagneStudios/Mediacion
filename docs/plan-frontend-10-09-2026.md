# Plan de Frontend — Ajustes de prueba (reunión del 10/09/2026)

**Fecha:** 10/09/2026 · **Autor:** Frontend
**Fuente:** `AJUSTES-PACTUM-2026-09-10.md` (ronda de prueba del cliente sobre la app funcionando).
**Rama:** `feat/ajustes-prueba-10-09`

---

## 0 · Resumen

Seis puntos, uno bloqueante (#4). Dos de ellos **ya existen parcialmente en el código** y son mucho más baratos de lo que parecía en la lectura del pedido: la pantalla de "unirse con código" ya está construida pero sin ningún link que lleve a ella, y la sección de invitar desde el detalle del caso ya existe para el estado `nuevo`, solo falta ampliarla a otros estados.

| # | Cambio | Estado | Alcance de esta tanda |
|---|--------|--------|------------------------|
| 1 | TyC dentro del alta | 🟡 Ya está en signup, falta sacar el duplicado | Quitar `AcceptanceCheckboxes` de `checkout.tsx` |
| 2 | Elección de plan (incl. free) dentro del alta | 🔴 No existe, hay que construir el wizard | `app/signup/{index,plan}.tsx` + `useSignupFlow` |
| 3 | Botón de cerrar sesión global | 🔴 Solo existe en `/profile/account` | `GlobalSignOutAction` reusable en topbar/tabs |
| 4 | Pantalla para ingresar código y unirse | 🟡 **Ya existe (`app/case/join.tsx`), está huérfana** | Agregar entry points + soporte de `?token=` |
| 5 | Invitar/reinvitar en cualquier momento | 🟡 Ya existe para `estado === 'nuevo'` | Ampliar condición + botón compartir |
| 6 | Sacar el pago 50/50 → suscripción individual | 🟡 No existe "50/50" literal, existe `pagoACargo` | Cosmético/preparatorio — enforcement real es de backend |

**Importante para la demo:** el punto 6 no puede quedar 100% resuelto desde frontend — el gate real de "cada parte paga la suya" es un trigger de backend (`trg_casos_gate_suscripciones`). Esta tanda solo saca el selector "quién paga" de la UI y ajusta el copy. Comunicar esto explícitamente al cliente, no presentarlo como cerrado end-to-end.

---

## 1 · Estado por punto

### #1 — TyC dentro del alta ✅ (10/09)
- [x] Se sacó `AcceptanceCheckboxes`, el estado `termsAccepted`/`marketingAccepted` y la llamada a `legalService.registerAcceptance()` de `app/profile/plan/checkout.tsx`. El botón de pago ya no depende de aceptar nada — la aceptación quedó una sola vez, en el signup.
- [x] `app/profile/plan/__tests__/checkout.test.tsx` reescrito sin los asserts de checkbox/gate.
- No se tocó `ReacceptanceGate` (mecanismo distinto: reaceptación de nuevas versiones de TyC).
- Suite completa verde (148/148), `tsc --noEmit` sin errores.

### #2 — Elección de plan dentro del alta ✅ (10/09)
- [x] `app/signup/_layout.tsx`, `app/signup/index.tsx` (paso 1, ex `app/signup.tsx`), `app/signup/plan.tsx` (paso 2). Eliminado `app/signup.tsx`.
- [x] **Simplificación respecto al plan original:** en vez de un Context Provider (`useSignupFlow`), el único dato que viaja entre pasos (`joinToken`, punto #4) se pasa como query param entre rutas (`/signup?joinToken=` → `/signup/plan?joinToken=`), igual que ya hace `/case/join?token=`. El paso 1 completa el registro por sí mismo (`signUp` + `registerAcceptance`); no hace falta un draft compartido de campos como en el wizard de casos.
- [x] Plan free = específicamente `plan.nombre === 'base'`, **no** `precio === 0` — `mocks/plans.ts` documenta que `plan-corporativo` también tiene precio 0 pero significa "a consultar", no gratis (decisión de producto abierta, `docs/plan-frontend-monetizacion.md` §1.2–§1.3). Gatillar por nombre evita que el wizard suscriba gratis a un plan pensado para venta negociada.
- [x] `billingService.subscribeToPlan(planId)` ya existía y sirve tal cual para el plan free (mock, un solo paso, sin checkout). Contra backend real queda **pendiente de confirmar** si `POST /suscripciones` short-circuitea igual para precio 0 — no bloquea, documentado.
- [x] **Bug real encontrado y arreglado** (no introducido por esta tanda): `onSuccess` en el signup leía `status` de `useAuthSession()` por closure, que queda obsoleto porque la promesa de `submitFn` resuelve después de que el componente ya re-renderizó con el nuevo status — la navegación post-signup nunca disparaba cuando la sesión se activaba sin confirmación de email. Arreglado con un `ref` que siempre lee el valor más reciente.
- [x] `AuthGate.tsx` ajustado: `/signup/plan` ya no hereda el status "público"/"auth route" del `/signup` bare (necesita sesión); y un visitante sin cuenta que abre un link de invitación (`/invitacion/*`) ahora es mandado a `/signup?joinToken=...` en vez de perder el código en `/login`.
- [ ] **Gap conocido (fuera de alcance de mañana):** el `joinToken` solo se propaga completo si el usuario elige el plan **free**. Si elige un plan pago, el wizard navega a `/profile/plan/checkout` sin forwardear el token — retomar el hilo tras un checkout (simulado o Mercado Pago real) requeriría tocar `checkout.tsx`, `receipt.tsx` y `billing/callback.tsx`, que no se justificaba para la prueba de aceptación de mañana (solo pide el camino free).

### #3 — Botón de cerrar sesión ✅ (10/09)
- [x] `features/profile/components/GlobalSignOutAction.tsx` (nuevo) — reusa `useAccountActions`/`SignOutDialog`, mismo wiring que `/profile/account` (sin duplicar lógica).
- [x] Montado en `components/DesktopTopbar.tsx` (desktop, junto al avatar).
- [x] Montado globalmente para mobile/compact en `app/_layout.tsx` (`CompactGlobalSignOut`, botón flotante arriba a la derecha, ya que en compact no hay un único punto de montaje como el topbar — cada sección fuera de `(tabs)` tiene su propio header nativo).
- [x] `app/profile/account.tsx` se dejó como está (su propia card con descripción es más apropiada ahí); no se duplicó lógica, solo hay dos presentaciones de UI sobre el mismo hook.
- [x] Tests: `features/profile/components/__tests__/GlobalSignOutAction.test.tsx` (nuevo), `components/__tests__/DesktopTopbar.test.tsx` (actualizado). Suite completa de `features/profile` + `components/__tests__` + `app/(tabs)/profile` verde (457 tests).

### #4 — Unirse a un caso con código (bloqueante) ✅ (10/09, parcial — falta la pata de #2)
- [x] CTA en `features/cases/CasesDashboardScreen.tsx`: botón "Unirme a un caso" en el header (junto a "Crear un caso") + acción en el `EmptyState`.
- [x] `app/case/join.tsx`: lee `?token=` de `useLocalSearchParams` y precarga el input.
- [x] `app/invitacion/[token].tsx` (nuevo): el link `mediacionapp://invitacion/mock-...` no resolvía a ninguna pantalla — esta ruta lo intercepta, reconstruye el string completo (necesario porque `CaseInvitation.token` para tipo "link" es la URL entera, no solo el segmento) y redirige a `/case/join?token=...`.
- [x] Nuevo ícono `user-plus` agregado al registro de `design-system/components/Icon.tsx` (no había ninguno adecuado para "unirse").
- [x] **Cerrado con #2:** un usuario sin cuenta que abre el link ahora llega a `/signup?joinToken=...` (ajuste en `AuthGate.tsx`) en vez de perder el código en `/login`; el wizard de signup lo propaga y redirige a `/case/join?token=...` al terminar (plan free) o lo mantiene pendiente si eligió pago (ver nota en #2 sobre el alcance limitado ahí).
- [x] Tests: `app/case/__tests__/join.test.tsx` (prefill), `app/invitacion/__tests__/[token].test.tsx` (nuevo), `features/cases/__tests__/CasesDashboardScreen.test.tsx` (CTA + empty state). Suite completa verde.

### #5 — Invitar en cualquier momento
- [ ] Ampliar en `features/cases/CaseDetailScreen.tsx` la condición que hoy limita la sección de invitación a `estado === 'nuevo'`.
- [ ] Botón "compartir" en `InvitationResultCard` (usar `Share` de `react-native`, sin dependencias nuevas).
- [ ] Fuera de alcance (decisión de producto ya documentada en el código): reenviar/regenerar invitación.

### #6 — Sacar el pago 50/50
- [ ] Quitar selector `pagoACargo` de `app/case/create/invite.tsx`.
- [ ] Cambiar copy de `app/case/[id]/payment-required.tsx` a "necesitás tu propia suscripción".
- [ ] Mantener el tipo `PagoACargo` en `types/case.ts` sin romper compatibilidad con el backend actual.
- [ ] **No implementable end-to-end sin backend** — dejar constancia en el PR.

---

## 2 · Verificación / E2E de aceptación

1. Crear cuenta nueva → aceptar TyC en el signup → elegir plan free en el wizard → termina sin pasar por checkout.
2. Crear un caso.
3. Invitar a la contraparte desde el detalle del caso (no solo desde el wizard de creación).
4. Desde otra cuenta: entrar por el botón "Unirme a un caso" del dashboard, o por el link con el token precargado.
5. Cerrar sesión desde ambas cuentas, probando el botón de logout desde una pantalla que no sea `/profile/account`.
6. Verificar que el checkout de un plan pago ya no vuelve a pedir aceptación de TyC.

Plan de implementación completo (contratos de componentes, snippets, riesgos) en la conversación de Claude Code del 10/09 — ver historial de la sesión si hace falta el detalle técnico.
