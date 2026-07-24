-- ============================================================
-- Proyecto Mediación — Migration: Propuesta estado state machine
-- Fecha: 2026-07-24
-- RN/CA: Máquina de estados de propuesta §5 (pendiente -> aceptada|rechazada)
-- Rollback: Ver comentarios por función/trigger
-- ============================================================

CREATE OR REPLACE FUNCTION validate_propuesta_estado_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'pendiente' AND NEW.estado IN ('aceptada', 'rechazada') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
END;
$$;
-- Rollback: DROP FUNCTION validate_propuesta_estado_transition();

CREATE TRIGGER trigger_validate_propuesta_estado
  BEFORE UPDATE OF estado ON propuestas
  FOR EACH ROW EXECUTE FUNCTION validate_propuesta_estado_transition();
-- Rollback: DROP TRIGGER IF EXISTS trigger_validate_propuesta_estado ON propuestas;
