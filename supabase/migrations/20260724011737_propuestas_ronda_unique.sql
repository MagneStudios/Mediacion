-- ============================================================
-- Proyecto Mediación — Migration: Propuestas caso_id+ronda_id unique
-- Fecha: 2026-07-24
-- RN/CA: una ronda solo puede tener una propuesta (evita doble generación IA)
-- Rollback: Ver comentarios por constraint
-- ============================================================

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

-- Una ronda no puede tener más de una propuesta
ALTER TABLE propuestas
  ADD CONSTRAINT propuestas_caso_ronda_unique UNIQUE (caso_id, ronda_id);
-- Rollback: ALTER TABLE propuestas DROP CONSTRAINT propuestas_caso_ronda_unique;

-- ============================================================
-- INDEXES
-- ============================================================

-- propuestas_caso_ronda_unique already creates a btree index on (caso_id, ronda_id)
DROP INDEX IF EXISTS idx_propuestas_caso_ronda;
