-- ============================================================
-- Proyecto Mediación — Migration: Mediaciones caso_id activa unique
-- Fecha: 2026-07-24
-- RN/CA: un caso solo puede tener una mediación activa a la vez
-- Rollback: DROP INDEX mediaciones_caso_activa_unique;
-- ============================================================

-- ============================================================
-- UNIQUE INDEXES
-- ============================================================

-- Un caso no puede tener más de una mediación en curso (solicitada/aceptada/activa)
CREATE UNIQUE INDEX mediaciones_caso_activa_unique ON mediaciones (caso_id)
  WHERE estado IN ('solicitada', 'aceptada', 'activa');
-- Rollback: DROP INDEX mediaciones_caso_activa_unique;
