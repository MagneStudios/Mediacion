-- ============================================================
-- Proyecto Mediación — Migration: Unicidad de accionables RN-14
-- Fecha: 2026-07-28
-- RN/CA: RN-14 — la generación post-firma debe ser idempotente
--        ante reentregas concurrentes del webhook de DocuSign
-- Rollback: Ver comentarios por índice
-- ============================================================

-- ============================================================
-- INDEXES
-- ============================================================

-- Un acuerdo no puede tener dos accionables con la misma descripción:
-- backstop de la guarda de existencia de TareasRepository.insertGenerated,
-- que por sí sola no sobrevive a dos transacciones concurrentes.
CREATE UNIQUE INDEX tareas_acuerdo_descripcion_unique
  ON tareas (acuerdo_id, descripcion);
-- Rollback: DROP INDEX IF EXISTS tareas_acuerdo_descripcion_unique;
