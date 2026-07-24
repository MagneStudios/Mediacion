-- ============================================================
-- Proyecto Mediación — Migration: Notificaciones vencimiento unique
-- Fecha: 2026-07-24
-- RN/CA: backstop de idempotencia ante disparos concurrentes del sweep
-- Rollback: Ver comentarios por índice
-- ============================================================

-- ============================================================
-- INDEXES
-- ============================================================

-- Un mismo usuario no puede recibir más de una notificación de vencimiento por caso
CREATE UNIQUE INDEX notificaciones_vencimiento_unique
  ON notificaciones (caso_id, evento, usuario_id)
  WHERE evento = 'vencimiento';
-- Rollback: DROP INDEX IF EXISTS notificaciones_vencimiento_unique;
