# Pedidos de Frontend — Ajustes de prueba del 10/09

**Fecha:** 10/09/2026 · **Autor:** Frontend · **Para:** Backend (§1) y DB + Producto (§2)
**Origen:** `docs/plan-frontend-10-09-2026.md` punto #2, cruzado contra el código real.
**Rama de FE:** `feat/ajustes-prueba-10-09`

---

## 0 · Por qué ahora

El punto #2 del plan le da a cada cuenta nueva un plan durante el alta: si elige el plan free (`base`), el wizard llama `billingService.subscribeToPlan(plan.id)` y da el alta por terminada en un solo paso, sin checkout. Contra el mock funciona. Contra backend real **no existe ningún camino que lo haga funcionar**:

- `subscribeToPlan` es mock puro — `services/api/billing.backed-service.ts:148-152` hace `return mock.subscribeToPlan(planId)`, nunca llama a la API.
- El camino real (`startCheckout`) hace `POST /suscripciones`, que **siempre** crea la fila en `pendiente_pago` (`apps/api/src/pagos/suscripciones.service.ts:104-115`), y sólo el webhook de Mercado Pago la pasa a `activa` (`applyPayment`, `pagos.repository.ts`).
- Un plan gratis no tiene pago → no hay webhook → la suscripción queda `pendiente_pago` para siempre, y el gate C-01 (`trg_casos_gate_suscripciones`) exige `activa` en las dos partes.

O sea: el único camino completo que dejó cableado el punto #2 (el free) es exactamente el que **no puede** llegar a `activa` contra backend real. No bloquea la demo (que corre contra mock), pero sí bloquea integrar el alta con backend.

---

## 1 · Backend — activar el plan free sin Mercado Pago

Necesitamos que `POST /suscripciones` (o un endpoint propio) **short-circuitee cuando el plan es gratis**: en vez de devolver `pendiente_pago`, cree la suscripción directamente en `activa` con el período de facturación anclado — lo mismo que hoy hace `applyPayment` al recibir un pago aprobado (`pagos.repository.ts`: `activa` + `current_period_start/end` de 30 días en el mismo `UPDATE`), pero sin pago de por medio.

Shape propuesto (mismo envelope de siempre):

```json
{ "id": "sus-…", "estado": "activa" }
```

y que el período (`current_period_start`/`current_period_end`, 30 días) quede escrito en el mismo `UPDATE` que `activa`, como ya hace el webhook.

**Decisiones que necesitamos tomadas (no las decide Frontend):**

- **Cuál es la señal de "gratis".** `precio = 0` no alcanza (§2: `corporativo` también es `0.00`). Hace falta `is_self_serve`, o `precio NULL` para `corporativo`, y que el backend resuelva contra esa columna explícita.
- **Dónde vive el short-circuit.** Si se resuelve dentro de `POST /suscripciones` (mirando el plan) o en un endpoint aparte. Cualquiera de las dos nos sirve; el front no quiere volver a distinguir por nombre de plan.

No es urgente para la demo de hoy (corre contra mock), pero conviene antes de que el alta esté conectada y un usuario real quede con una cuenta sin plan activo.

---

## 2 · DB + Producto — distinguir "gratis" de "a consultar" (ya pedido, ahora bloquea)

`docs/pedidos-frontend-monetizacion.md` §5.1 ya pidió `is_self_serve` en `planes` (o `precio NULL` para `corporativo`), porque `base` y `corporativo` cuestan los dos `0.00` y el front no puede distinguir "gratis" de "a consultar".

El punto #2 lo dejó más urgente y más visible: el front hoy trabaja con `plan.nombre === 'base'` (`app/signup/plan.tsx`), que funciona para el mock pero es frágil — y el short-circuit de §1 **necesita la misma señal** para saber qué plan activar sin pago. Una sola fuente (`is_self_serve`) resuelve los dos lados.

---

## Verificación (para que no haga falta re-chequear)

- Backend: `createSuscripcion` es literalmente `insert` en `pendiente_pago` + `{ id, estado }` (`suscripciones.service.ts:104-115`); no hay ningún branch por precio.
- Frontend: `subscribeToPlan` = mock (verificado en `billing.backed-service.ts:148-152`).
