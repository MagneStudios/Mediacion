-- ============================================================
-- Proyecto Mediación — Migration 44: la máquina de estados de
-- casos también corre en INSERT (no solo UPDATE)
-- Fecha: 2026-09-09
-- Fuente: auditoría FE 09-09 (hallazgo técnico A) — el trigger
--         `trigger_validate_caso_estado` era `BEFORE UPDATE OF estado`,
--         así que un INSERT directo salteaba la máquina de estados.
-- Cambios:
--   - validate_caso_estado_transition() ahora valida TG_OP = 'INSERT':
--     el estado inicial solo puede ser 'nuevo' o 'pendiente_suscripciones'.
--   - trigger_validate_caso_estado pasa a BEFORE INSERT OR UPDATE OF estado.
-- Aditivo: no toca enums, RLS ni db-types.
-- Rollback: recrear el trigger como BEFORE UPDATE OF estado y la función
--           sin la rama INSERT (versión de 20260909120000).
-- ============================================================

CREATE OR REPLACE FUNCTION validate_caso_estado_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado IS DISTINCT FROM 'nuevo' AND NEW.estado IS DISTINCT FROM 'pendiente_suscripciones' THEN
      RAISE EXCEPTION 'Estado inicial inválido en INSERT: % (solo se permite nuevo o pendiente_suscripciones)', NEW.estado;
    END IF;
    RETURN NEW;
  END IF;

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

  -- Renegociación: la única transición que sale de `acordado` sin cerrar
  -- el caso. La escribe `CasosRepository.reopenFromAcordado`, dentro de
  -- la misma transacción que supersede el acuerdo vigente.
  IF OLD.estado = 'acordado' AND NEW.estado = 'en_negociacion' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_caso_estado ON casos;

CREATE TRIGGER trigger_validate_caso_estado
  BEFORE INSERT OR UPDATE OF estado ON casos
  FOR EACH ROW EXECUTE FUNCTION validate_caso_estado_transition();
