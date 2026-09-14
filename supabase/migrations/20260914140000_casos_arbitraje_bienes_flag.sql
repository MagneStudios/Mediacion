-- ============================================================
-- Flag de arbitraje por materia del caso (FEATURE_ARBITRAJE_BIENES)
-- Fecha: 2026-09-14
-- Granularidad: por caso (la materia del caso). No global.
-- Decisión: docs/decisiones-db/2026-09-14-arbitraje-bienes-flag.md
-- No se tocan RLS/grants de casos (el flag vive en casos; ya accesible
-- a partes del caso + admin vía policies existentes).
-- Rollback: ALTER TABLE casos DROP COLUMN arbitraje_bienes_habilitado;
-- ============================================================

ALTER TABLE casos ADD COLUMN IF NOT EXISTS arbitraje_bienes_habilitado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN casos.arbitraje_bienes_habilitado IS
  'Flag por caso (granularidad de la materia del caso) para habilitar arbitraje. False por defecto. '
  'Solo se pone true para materia "bienes"; NUNCA para familia (TYC H.5/H.6 lo prohíbe y el enum '
  'metodo_caso no incluye arbitraje). La validación de "solo bienes" es responsabilidad de Backend.';