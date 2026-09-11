# Changelog — Proyecto Mediación

## 2026-09-10 — Ajustes de la ronda de prueba del cliente + cuenta no provisionada

**Origen:** `docs/plan-frontend-10-09-2026.md` (los 6 ajustes) y, por fuera del plan, el manejo de `user_not_provisioned`/`profile_not_found` que había quedado sin commitear. Toca sólo `mediacion-app` y `docs/`.

---

### Los 6 ajustes de la ronda (ya commiteados)

Cubren lo que pidió el cliente sobre la app funcionando. El detalle técnico completo está en `docs/plan-frontend-10-09-2026.md`; acá lo que importa para leer el repo después:

1. **TyC sólo en el alta.** `app/profile/plan/checkout.tsx` ya no llama a `legalService.registerAcceptance()` ni muestra `AcceptanceCheckboxes` — la aceptación quedó una sola vez, en `app/signup/index.tsx`. `ReacceptanceGate` no se tocó (mecanismo distinto).
2. **Elección de plan dentro del alta.** Wizard de 2 pasos: `app/signup/index.tsx` (paso 1) → `app/signup/plan.tsx` (paso 2). El plan free es `plan.nombre === 'base'`, **no** `precio === 0` (`corporativo` también tiene precio 0 pero es "a consultar"). `billingService.subscribeToPlan()` ya existía y sirve tal cual para el free.
3. **Cerrar sesión global.** `GlobalSignOutAction` reusa `useAccountActions`/`SignOutDialog`; montado en `DesktopTopbar` y en un botón flotante para compact/mobile (`CompactGlobalSignOut` en `app/_layout.tsx`).
4. **Unirse con código.** CTA en `CasesDashboardScreen`, `app/case/join.tsx` precarga `?token=`, y `app/invitacion/[token].tsx` reconstruye el link completo antes de redirigir. `AuthGate` manda a `/signup?joinToken=...` a quien abre un link sin cuenta.
5. **Invitar en cualquier momento.** Alcance revisado contra la máquina de estados: la sección de invitación ya cubría `nuevo` (único estado sin contraparte). Lo que faltaba: badge del `EstadoInvitacion` en el detalle y botón "compartir" en `InvitationResultCard`.
6. **Sacar el 50/50.** Se sacó el selector "quién paga" de `app/case/create/invite.tsx`; `CreateInvitationInput.pagoACargo` pasó a opcional y el front nunca lo define. El gate real de "cada parte paga la suya" sigue siendo de backend (`trg_casos_gate_suscripciones`) — esto es sólo UI/copy.

**Decisiones/gaps que quedaron escritos:** el `joinToken` sólo se propaga completo si se elige el plan **free** (un plan pago navega a checkout sin forwardear el token); y el punto 6 no es end-to-end sin backend.

---

### Cuenta no provisionada (`sessionBroken`) — sin commitear

Esto **no** era parte del plan: quedó en el árbol de trabajo cuando arrancamos la revisión. Es frontend puro y consume códigos que backend ya devuelve.

**El problema.** Un usuario logueado en Supabase sin fila en `public.usuarios` (o cuyo `GET /me` / `PATCH /me` responde `404 profile_not_found`) caía en el `ErrorState` genérico con "reintentar". Reintentar manda la misma request y vuelve a fallar para siempre — la única acción útil es cerrar sesión.

**La solución.** `useProfile` distingue un tercer estado, `sessionBroken`, vía el helper `utils/is-unrecoverable-session-error.ts`, que agrupa `user_not_provisioned` y `profile_not_found`. La pantalla de perfil muestra "Tu cuenta todavía no está lista" con la acción "Cerrar sesión" (`onRetry={signOut}`) en vez del reintento.

**Detalle de los archivos:** `services/api/api-error.ts` (nueva constante `codeProfileNotFound`), `utils/is-unrecoverable-session-error.ts` (nuevo), `features/profile/hooks/useProfile.ts`, `app/(tabs)/profile.tsx`, y sus dos tests. Las keys i18n `profile.sessionBroken.*` **ya estaban commiteadas** (entraron en `7c0e1a0`, el commit del punto 3) — el código que las consume es lo pendiente.

**Backend ya listo:** `user_not_provisioned` sale del `AuthGuard` (`apps/api/src/auth/auth.guard.ts:66`) y `profile_not_found` de `me.service.ts` / `me.controller.ts` (y `onboarding.service.ts`).

---

### QA

- `pnpm jest` — **150 suites / 1356 tests**, 0 fallas (incluye los tests nuevos de `sessionBroken`).
- `pnpm tsc -b` — **una salvedad**: falla en `app/signup/index.tsx:64` con `'/signup/plan'` no asignable. No es un error de código: `.expo/types/router.d.ts` es un archivo generado y gitignoreado que quedó desactualizado (se generó antes de crearse `app/signup/plan.tsx` y `app/invitacion/[token].tsx`). Se regenera con `expo start`.

---

### Lo que queda

- (Del plan) el `joinToken` para plan pago, y el enforcement real del punto 6, siguen dependiendo de backend/checkout real.

---

### Post-merge: 2 bugs encontrados al testear contra `fix(pagos)`/`fix(casos)` (10/09, mismo día)

Al pedir "testeá que esté bien" después del merge de PR #134, contra el resto de lo que ya estaba en `dev` (`9562c35` fix(pagos), `9a5e441` fix(casos), `a10c0aa` sessionBroken — este último ya sí quedó commiteado, cerrando el ítem anterior):

1. **`pnpm tsc -b` (el typecheck de CI) estaba roto en `dev`.** `apps/api/src/pagos/pagos.service.spec.ts:21` llamaba `jest.fn().mockResolvedValue()` sin argumento — TS2554. No lo introdujo el punto 6 ni nada de esta tanda; venía de `fix(pagos)` (`9562c35`), mergeado directo a `dev` en paralelo. Un caracter de más (`mockResolvedValue(undefined)`) lo arregla.
2. **`app/signup/plan.tsx` (punto 2) llamaba `billingService.subscribeToPlan()` para el plan free — que es y será mock-only para siempre** (no hay endpoint de factura, ver `services/api/billing.backed-service.ts`). Contra backend real eso simulaba un éxito local sin crear ninguna suscripción de verdad: un usuario nuevo hubiera terminado el alta creyendo tener el plan free activo y chocado con `NO_ACTIVE_SUBSCRIPTION` en el primer intento de crear un caso — justo el error que `fix(casos)` (`9a5e441`, mergeado el mismo día) se ocupa de mostrar con claridad, pero que nunca debería haber aparecido para alguien que "ya" tenía el plan free. Cambiado a `billingService.startCheckout()`, que desde `fix(pagos)` resuelve el precio 0 sin pasar por Mercado Pago (`kind: 'activated'`) — es el mismo método que ya usa `/profile/plan/checkout`.

Ambos arreglados, testeados (`pnpm jest` en `mediacion-app` — 150/150, 1361 tests; `pnpm --filter @mediacion/api test` — 151/151 suites no gateadas por `DATABASE_URL`) y pusheados a `dev`.
