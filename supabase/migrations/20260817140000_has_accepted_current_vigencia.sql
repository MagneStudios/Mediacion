-- ============================================================
-- Proyecto Mediación — Migration: has_accepted_current usa vigencia real
-- Fecha: 2026-08-17
-- Origen: hallazgo del review adversarial de spec-tyc-cierre-pendientes
-- ============================================================
-- EL PROBLEMA
--
-- has_accepted_current (20260814170000_tyc_legal.sql) define "la versión
-- actual" como `ld.valid_to IS NULL`. Todo el resto del sistema la define
-- como vigencia real: LegalRepository.findVigente y findVigentes filtran
-- `valid_from <= now AND (valid_to IS NULL OR valid_to > now)`, y el
-- endpoint público hace lo mismo.
--
-- Mientras hay una sola fila por tipo las dos definiciones coinciden. Dejan
-- de coincidir en el momento exacto en que se programa una publicación —
-- que es justamente lo que el instructivo §4.8 obliga a hacer, con 10 días
-- de anticipación, y para lo que existen el barrido de avisos
-- (legal-avisos.scheduler.ts) y el banner de preaviso del punto #16.
--
-- El índice parcial `legal_documents_tipo_vigente_unique ON (tipo) WHERE
-- valid_to IS NULL` admite UNA sola fila con valid_to nulo por tipo. O sea
-- que publicar una v2.0 programada obliga a ponerle valid_to a la v1.0 que
-- está rigiendo, y entonces `valid_to IS NULL` pasa a apuntar a la versión
-- FUTURA.
--
-- Verificado sobre una base con el esquema de agosto:
--
--   has_accepted_current(usuario, 'terms')  -- antes de programar:  true
--   UPDATE legal_documents SET valid_to = now() + 10 days WHERE ...
--   INSERT INTO legal_documents (v2.0, valid_from = now() + 10 days, ...)
--   has_accepted_current(usuario, 'terms')  -- después:            false
--
-- Consecuencias durante los 10 días de preaviso, con el esquema actual:
--
-- 1. validate_suscripcion_aceptacion rechaza CUALQUIER alta de suscripción
--    con 409, para todos los usuarios, en las dos ramas.
-- 2. Y no se puede arreglar aceptando: POST /legal/aceptaciones escribe la
--    versión que devuelve findVigentes — la v1.0, correctamente, porque es
--    la que rige — mientras has_accepted_current exige la v2.0. El usuario
--    queda bloqueado para contratar hasta que la v2.0 entre en vigencia.
-- 3. GET /legal/aceptaciones/vigente informa `terms` como pendiente sin que
--    haya nada que el usuario pueda hacer al respecto.
--
-- O sea: cumplir con el preaviso legal cerraba la contratación de la
-- plataforma. El agujero es de 20260814170000, no de este ciclo, pero es
-- este ciclo el que lo vuelve alcanzable: el banner del #16 existe
-- precisamente para el estado que lo dispara.
-- ============================================================
-- LA CORRECCIÓN
--
-- Una sola definición de vigencia, la misma que usa el resto del sistema.
-- No se toca la tabla, ni el índice, ni la forma de publicar: solo se
-- alinea la función con lo que su propio nombre dice.
--
-- Rollback: volver a la versión de 20260814170000_tyc_legal.sql —
--   CREATE OR REPLACE FUNCTION public.has_accepted_current(
--     p_user_id UUID, p_document_type TEXT
--   ) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
--   SET search_path = '' AS $$
--     SELECT EXISTS (
--       SELECT 1 FROM public.user_agreements ua
--       JOIN public.legal_documents ld
--         ON ld.tipo = ua.document_type AND ld.valid_to IS NULL
--       WHERE ua.user_id = p_user_id
--         AND ua.document_type = p_document_type
--         AND ua.accepted = true
--         AND ua.document_version = ld.version
--     );
--   $$;
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_accepted_current(
  p_user_id UUID,
  p_document_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_agreements ua
    JOIN public.legal_documents ld
      ON ld.tipo = ua.document_type
     AND ld.valid_from <= now()
     AND (ld.valid_to IS NULL OR ld.valid_to > now())
    WHERE ua.user_id = p_user_id
      AND ua.document_type = p_document_type
      AND ua.accepted = true
      AND ua.document_version = ld.version
  );
$$;

-- Los permisos de 20260814170000 se mantienen: CREATE OR REPLACE no los
-- resetea. Se repiten igual para que la migración sea legible sola.
REVOKE EXECUTE ON FUNCTION public.has_accepted_current(UUID, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_accepted_current(UUID, TEXT)
  TO service_role, postgres, authenticated;
