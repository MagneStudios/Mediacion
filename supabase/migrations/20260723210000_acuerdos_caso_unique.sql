-- ============================================================
-- Proyecto Mediación — Migration: Acuerdos caso_id unique
-- Fecha: 2026-07-23
-- RN/CA: un caso solo puede tener un acuerdo
-- Rollback: Ver comentarios por constraint
-- ============================================================

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

-- Un caso no puede tener más de un acuerdo
ALTER TABLE acuerdos
  ADD CONSTRAINT acuerdos_caso_unique UNIQUE (caso_id);
-- Rollback: ALTER TABLE acuerdos DROP CONSTRAINT acuerdos_caso_unique;

-- ============================================================
-- INDEXES
-- ============================================================

-- acuerdos_caso_unique already creates a btree index on caso_id
DROP INDEX IF EXISTS idx_acuerdos_caso;
