# Decisiones — Distinguir plan free/self-serve de "a consultar" (`is_self_serve` en `planes`)

**Fecha:** 10/09/2026
**Fuente:** `docs/pedidos-frontend-ajustes-10-09.md` §2 (FE→DB) sobre `docs/AJUSTES-PACTUM-2026-09-10.md` (ronda de prueba cliente 10/09). Cruzado con `docs/changelogs/2026-09-10-ajustes-prueba.md`.
**Contexto:** hoy `base` y `corporativo` valen ambos `precio = 0.00`. `base` es el plan free self-serve; `corporativo` es "a consultar" (se contrata por ventas, no por el wizard del alta). El backend activa el plan gratis comparando `precio === 0` (`isFreePlan` en `pagos.service.ts`, commit `9562c35`), lo que erróneamente activa también `corporativo`. El frontend elige el free por `plan.nombre === 'base'`. Ambos acoplan la señal al detalle de precio en vez de a la intención de negocio. El equipo quiere una fuente única de verdad.

## Decisiones

1. **Columna `is_self_serve BOOLEAN NOT NULL DEFAULT true`** en `planes`.
2. **`is_self_serve = false` SOLO para `corporativo`** (el único plan "a consultar", `precio 0.00`). El resto = `true`: `base` (0.00, free), `simple` (9.99), `plus` (19.99), `particular` (19.90), `estudio` (25.00, paid self-serve). Verificado en seed: `estudio` = 25.00, **NO** es "a consultar".
3. **Semántica:** `true` = el alta puede contratarlo (incluye `base` gratis y planes de pago); `false` = "a consultar", fuera del self-serve (lo cierra ventas, no el wizard).
4. **El alta free la sigue dando el Backend durante el signup** (`activateFreeSuscripcion`, `9562c35`) — **no** un trigger DB en `auth.users`. Razón de esquema: `trigger_validate_suscripcion_aceptacion` (`20260814170000_tyc_legal.sql:189`) exige `has_accepted_current(usuario_id,'terms')` para INSERT en `suscripciones`, y en el alta de Auth la TyC todavía no está aceptada (la aceptación quedó en el signup, `AJUSTES-PACTUM §1`: TyC primero, plan después). Un trigger en `handle_new_user` chocaría con ese gate.
5. **No backfill** para usuarios existentes sin suscripción: criterio del equipo "solo altas nuevas". Los existentes sin plan pasan por el flujo normal (aceptan TyC y eligen plan).

## Principio de ejecución (por partes)

- **Una migración aditiva #45** (`20260910120000_planes_is_self_serve.sql`): `ADD COLUMN` + `UPDATE corporativo`. Sin DROP/RENAME/ALTER COLUMN TYPE.
- **db-types hand-maintained** (`packages/db-types`): sumar `is_self_serve` al tipo de `planes`.
- **Docs**: `docs/database.md` (sección `planes`); changelog `docs/changelogs-db/2026-09-10.md`.

## Frontera congelada (DB→BE/FE)

- DB expone `is_self_serve`. **BE** debe cambiar `isFreePlan(precio)` → leer `planes.is_self_serve` (pedido Paso 5). **FE** debe cambiar el wizard free de `plan.nombre === 'base'` → el flag `is_self_serve` que devuelva BE.
- Hasta que BE/FE consuman la columna, el BE sigue activando `corporativo` como free (bug conocido). No bloquea la demo: el wizard free solo muestra `base`.
- `precio` sigue `NOT NULL`; no se toca. No se modifica `handle_new_user`; no backfill.

## Referencias

- `docs/pedidos-frontend-ajustes-10-09.md` §2, `docs/AJUSTES-PACTUM-2026-09-10.md` §2, `docs/changelogs/2026-09-10-ajustes-prueba.md`
- `supabase/migrations/20260814170000_tyc_legal.sql` (trigger aceptación TyC), `20260821120000_monetizacion_fase1.sql` (corporativo `0.00` = "a consultar")
- Prompt de implementación: `docs/prompts-db/2026-09-10-planes-is-self-serve.md`
