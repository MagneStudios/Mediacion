# Prompt DB — Flag de arbitraje por materia `FEATURE_ARBITRAJE_BIENES`

Ejecutá esta migración en `X:\proyectos-uni\Mediacion\supabase\migrations\` y actualizá
los artefactos de tipos/docs. No edites nada fuera de lo pedido.

## Convenciones (respetar)
- Migración aditiva, idempotente, rollback documentado.
- El flag se modela **a nivel de caso** (no existe entidad `materia` en el schema).
  Ver `docs/decisiones-db/2026-09-14-arbitraje-bienes-flag.md`.
- No se tocan RLS/grants de `casos` (el flag vive en `casos`, ya accesible a partes del caso + admin).

## 1) Crear `supabase/migrations/20260914140000_casos_arbitraje_bienes_flag.sql`

```sql
-- ============================================================
-- Flag de arbitraje por materia del caso (FEATURE_ARBITRAJE_BIENES)
-- Granularidad: por caso (la materia del caso). No global.
-- Rollback: ALTER TABLE casos DROP COLUMN arbitraje_bienes_habilitado;
-- ============================================================

ALTER TABLE casos ADD COLUMN arbitraje_bienes_habilitado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN casos.arbitraje_bienes_habilitado IS
  'Flag por caso (granularidad de la materia del caso) para habilitar arbitraje. False por defecto. '
  'Solo se pone true para materia "bienes"; NUNCA para familia (TYC H.5/H.6 lo prohíbe y el enum '
  'metodo_caso no incluye arbitraje). La validación de "solo bienes" es responsabilidad de Backend.';
```

## 2) `packages/db-types/src/database.types.ts`
En `casos` (Row/Insert/Update), agregá `arbitraje_bienes_habilitado: boolean`. No borres nada.

## 3) `docs/database.md`
En la descripción de la tabla `casos`, agregá la columna
`arbitraje_bienes_habilitado BOOLEAN NOT NULL DEFAULT false` con su comentario.

## 4) `docs/changelogs-db/2026-09-14.md`
Si existe, agregá entrada:
`- 20260914140000_casos_arbitraje_bienes_flag.sql — casos.arbitraje_bienes_habilitado (flag por caso, FEATURE_ARBITRAJE_BIENES).`

## Reportá
Lista de paths creados/modificados.
