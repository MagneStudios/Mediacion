-- ============================================================
-- Proyecto Mediación — Migration 43: renegociación reabre el caso
-- Fecha: 2026-09-09
-- RN/CA: §2.4 de docs/pedidos-frontend-acuerdos-modulares.md —
--        POST /negociaciones/:id/renegociar abre una ronda nueva sobre
--        una materia ya firmada. Con `acordado` derivado de "todas las
--        materias con acuerdo vigente+firmado" (§3 de
--        docs/decisiones-db/2026-09-06-acuerdos-modulares.md), reabrir
--        una materia deja de hacer cierta esa afirmación, así que el
--        caso tiene que poder volver a `en_negociacion`.
-- Reglas: SOLO CREATE OR REPLACE FUNCTION sobre
--         validate_caso_estado_transition(). Aditivo: agrega una
--         transición, no saca ninguna. No toca triggers, enums ni
--         db-types.
-- Rollback: CREATE OR REPLACE FUNCTION sin el bloque nuevo — la versión
--           de 20260906100000_pendiente_suscripciones_writable.sql.
-- Escrita por BE: coordinar con el rol de DB (agents/db/).
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

  -- Renegociación: la única transición que sale de `acordado` sin cerrar
  -- el caso. La escribe `CasosRepository.reopenFromAcordado`, dentro de
  -- la misma transacción que supersede el acuerdo vigente.
  IF OLD.estado = 'acordado' AND NEW.estado = 'en_negociacion' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
END;
$$;
