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

### #1 — TyC dentro del alta
- [ ] Quitar `AcceptanceCheckboxes`, estado `termsAccepted`/`marketingAccepted` y `legalService.registerAcceptance()` de `app/profile/plan/checkout.tsx`.
- [ ] Actualizar `app/profile/plan/__tests__/checkout.test.tsx`.
- No tocar `ReacceptanceGate` (mecanismo distinto).

### #2 — Elección de plan dentro del alta
- [ ] `app/signup/_layout.tsx`, `app/signup/index.tsx` (paso 1, ex `app/signup.tsx`), `app/signup/plan.tsx` (paso 2).
- [ ] `features/auth/hooks/useSignupFlow.tsx` (Context Provider, patrón `useCaseCreationFlow`).
- [ ] Eliminar `app/signup.tsx`.
- [ ] Verificar `billingService.subscribeToPlan` con plan free (precio 0) — contra mock funciona; contra backend real queda **pendiente de confirmar contrato**.

### #3 — Botón de cerrar sesión
- [ ] `features/profile/components/GlobalSignOutAction.tsx` (nuevo, extraído de `app/profile/account.tsx`).
- [ ] Montar en `components/DesktopTopbar.tsx` y en `app/(tabs)/_layout.tsx` (headerRight).
- [ ] Reusar en `app/profile/account.tsx`.

### #4 — Unirse a un caso con código (bloqueante)
- [ ] CTA en `features/cases/CasesDashboardScreen.tsx` (header + empty state).
- [ ] `app/case/join.tsx`: leer `?token=` de `useLocalSearchParams` y precargar el input.
- [ ] Wizard de signup (#2) propaga `?joinToken=` y redirige a `/case/join?token=...` al terminar si corresponde.

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
