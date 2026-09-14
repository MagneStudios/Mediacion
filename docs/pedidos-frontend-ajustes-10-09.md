# Pedidos de Frontend — Ajustes de prueba del 10/09 (actualizado tras el merge de `dev`)

**Fecha:** 10/09/2026 (actualizado 10/09) · **Autor:** Frontend · **Para:** DB + Producto (§2), y Backend (§2)
**Origen:** `docs/plan-frontend-10-09-2026.md` punto #2, cruzado contra el código real.
**Rama de FE:** `feat/ajustes-prueba-10-09`

---

## 0 · Dónde quedó esto

El punto #2 del plan le da a cada cuenta nueva un plan durante el alta. Cuando se escribió este doc, el camino free (`billingService.subscribeToPlan`) era **mock puro** y no existía forma de que un plan gratis llegara a `activa` contra backend real.

**Desde el merge de `dev` (10/09) eso cambió a medias.** Backend implementó la activación del plan gratis en `9562c35` (§1 ya está hecho). Lo que **sigue abierto** es la señal de "gratis" que el backend usó para eso: `precio === 0`, que también matchea `corporativo` (§2).

---

## 1 · Backend — activar el plan free sin Mercado Pago ✅ implementado (10/09, `9562c35`)

Backend lo resolvió en `fix(pagos): el plan de precio 0 se activa sin pasar por Mercado Pago`:

- `createPreference` (`pagos.service.ts`) detecta el plan gratis con `isFreePlan(precio)`, que **parsea** `planes.precio` (NUMERIC llega como `"0.00"`) y compara `=== 0`.
- Si es gratis, `activateFreeSuscripcion` (`pagos.repository.ts`) escribe `estado = activa` + el período de facturación de 30 días en el mismo `UPDATE` que hace `applyPayment`, y devuelve `{ init_point: null, estado: "activa" }`.
- Del lado FE, `CheckoutStart` suma la variante `activated` y `checkout.tsx` la maneja yendo a `/billing/callback`.

**Qué sigue faltando del lado nuestro (Frontend, no Backend):** el wizard de alta free (`app/signup/plan.tsx`) sigue llamando a `billingService.subscribeToPlan`, que es **mock**. Para que el alta free funcione contra backend real hay que pasar ese camino por `startCheckout`, que es el que devuelve `activated`. Es trabajo de front, no un pedido.

---

## 2 · DB + Producto — distinguir "gratis" de "a consultar" (abierto, ahora bloquea a los dos lados)

`docs/pedidos-frontend-monetizacion.md` §5.1 ya pidió `is_self_serve` en `planes` (o `precio NULL` para `corporativo`), porque `base` y `corporativo` cuestan los dos `0.00` y no se puede distinguir "gratis" de "a consultar".

**El merge de `dev` lo dejó más urgente, no menos:** el short-circuit de §1 se implementó sobre `precio === 0`, así que **el backend hoy activa gratis también a `corporativo`** (que cuesta `0.00` pero es "a consultar", no self-serve). No es un bug bloqueante para la demo de mañana —el plan base es el único que aparece en el wizard free— pero es exactamente el caso de borde que `is_self_serve` viene a resolver.

**Estado 10/09 — DB: RESUELTO ✅** (rama `feat/supabase-db`). Migración `20260910120000_planes_is_self_serve.sql`: `ALTER TABLE planes ADD COLUMN is_self_serve BOOLEAN NOT NULL DEFAULT true`; `UPDATE planes SET is_self_serve = false WHERE nombre = 'corporativo'` (único plan "a consultar"). `base`/`simple`/`plus`/`particular`/`estudio` quedan `true`. Decisión: `docs/decisiones-db/2026-09-10-planes-self-serve.md`; changelog: `docs/changelogs-db/2026-09-10.md`; db-types actualizado. Auditado: `supabase db lint` limpio, `db reset` 45 migraciones, `smoke_migrations.py` 92/92, typecheck db-types OK, `validate_rls.py` 44/61 (los 17 fallos son preexistentes y ajenos a `planes`).

Lo que falta de tu lado, con la columna ya en `planes` (y en db-types):

- **Backend:** `isFreePlan(precio)` → resolver contra `planes.is_self_serve`. El free del alta es `base` (`precio = 0 AND is_self_serve`); no activar `corporativo` (`is_self_serve = false`). Dejar de usar `precio === 0` como señal.
- **Frontend:** el wizard free deja de gatillar por `plan.nombre === 'base'` y usa `is_self_serve` (o el flag que BE devuelva desde `GET /planes`).

---

## Verificación (para que no haga falta re-chequear)

- Backend, activación free: `isFreePlan` en `pagos.service.ts` (`precio === 0`), `activateFreeSuscripcion` en `pagos.repository.ts`.
- Backend, ambigüedad: `planes` seed con `base` y `corporativo` ambos en `0.00` (`docs/pedidos-frontend-monetizacion.md` §5.1).
- Frontend, camino free mock: `subscribeToPlan` = mock (`billing.backed-service.ts:148-152`); el camino real que devuelve `activated` es `startCheckout`.
