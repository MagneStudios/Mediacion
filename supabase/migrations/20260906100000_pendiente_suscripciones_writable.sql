-- ============================================================
-- Proyecto Mediación — Migration 39: pendiente_suscripciones writable
-- Fecha: 2026-09-06
-- RN/CA: C-01 follow-up — estado `pendiente_suscripciones` escribible.
--        BE escribe el estado en el catch del P0001 del gate.
-- Reglas: SOLO CREATE OR REPLACE FUNCTION sobre validate_caso_estado_transition().
--         No toca trg_casos_gate_suscripciones ni db-types.
-- Rollback: CREATE OR REPLACE FUNCTION a la versión anterior (sin los dos
--           bloques nuevos) — ver 20260810120000_cambios_reunion_07_08.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION validate_caso_estado_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'nuevo' AND NEW.estado IN ('activo', 'terminado', 'expirado') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'nuevo' AND NEW.estado = 'pendiente_suscripciones' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'pendiente_suscripciones' AND NEW.estado IN
     ('activo', 'en_negociacion', 'terminado', 'vencido', 'expirado') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'activo' AND NEW.estado IN ('en_negociacion', 'terminado', 'vencido', 'expirado') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'en_negociacion' AND NEW.estado IN ('acordado', 'terminado', 'vencido') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'acordado' AND NEW.estado = 'cerrado' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
END;
$$;
-- Rollback: CREATE OR REPLACE FUNCTION sin los dos bloques de
--           'pendiente_suscripciones' (versión de 20260810120000).