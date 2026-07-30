-- ============================================================
-- Proyecto Mediación — Migration: schema for the remaining frontend gaps
-- Fecha: 2026-07-30
--
-- Closes the three gaps in docs/integration-contract.md that needed new schema
-- rather than just an endpoint. The rest of that list (invitation reads,
-- signature inbox, agreement history, activity timeline, per-signer status,
-- account deactivation) is served by endpoints over existing tables and needs
-- nothing here.
-- ============================================================

-- 1. Human-readable case code -------------------------------------------------
--
-- `CaseDetail.caseCode` is currently fabricated client-side as CASO-YYYY-NNNN
-- (`services/cases.service.ts`), so two devices show different codes for the
-- same caso and nobody can quote one over the phone. The server owns it now.
--
-- Backfilled deterministically from creation order per year, so existing casos
-- get stable codes instead of being renumbered on every deploy.
ALTER TABLE casos ADD COLUMN IF NOT EXISTS codigo TEXT;

WITH numbered AS (
  SELECT
    id,
    to_char(created_at, 'YYYY') AS anio,
    row_number() OVER (
      PARTITION BY to_char(created_at, 'YYYY') ORDER BY created_at, id
    ) AS n
  FROM casos
  WHERE codigo IS NULL
)
UPDATE casos c
SET codigo = 'CASO-' || numbered.anio || '-' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE c.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS casos_codigo_unique ON casos (codigo);

-- Assigned on insert. A sequence would be simpler but would leak the global
-- caso count to anyone who creates one; per-year numbering keeps the disclosure
-- to "how many casos this year", which the code already implies by design.
CREATE OR REPLACE FUNCTION public.assign_caso_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  anio TEXT := to_char(COALESCE(NEW.created_at, now()), 'YYYY');
  siguiente INTEGER;
BEGIN
  IF NEW.codigo IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Serialised against concurrent inserts for the same year: without the lock
  -- two simultaneous creations both read the same max and collide on the unique
  -- index. pg_advisory_xact_lock releases at commit, no cleanup needed.
  PERFORM pg_advisory_xact_lock(hashtext('caso_codigo_' || anio));
  SELECT COALESCE(MAX(substring(codigo from 11)::integer), 0) + 1
    INTO siguiente
    FROM public.casos
   WHERE codigo LIKE 'CASO-' || anio || '-%';
  NEW.codigo := 'CASO-' || anio || '-' || lpad(siguiente::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_caso_codigo ON casos;
CREATE TRIGGER trigger_assign_caso_codigo
  BEFORE INSERT ON casos
  FOR EACH ROW EXECUTE FUNCTION public.assign_caso_codigo();

-- 2. Notice read state --------------------------------------------------------
--
-- `notificaciones.estado` is a DELIVERY status ('pendiente'|'enviada'|'fallida')
-- and must not be overloaded as a read receipt — a notice can be delivered and
-- unread, or read after a failed push. Separate column, nullable: NULL means
-- unread, which needs no backfill and no default.
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS leido_at TIMESTAMPTZ;

-- Unread-count queries are per user and hit this on every screen load.
CREATE INDEX IF NOT EXISTS notificaciones_usuario_no_leidas
  ON notificaciones (usuario_id) WHERE leido_at IS NULL;

-- 3. Notification preferences -------------------------------------------------
--
-- Seven booleans the frontend already models (`types/profile.ts`). A JSONB
-- column rather than seven columns or a side table: the set is presentation
-- policy that will churn, and adding an eighth toggle should not be a migration.
-- Defaulted so every existing user is opted in, matching today's behaviour where
-- everything is sent.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS preferencias_notificacion JSONB
  NOT NULL DEFAULT '{
    "caseUpdates": true,
    "proposalReady": true,
    "responseReceived": true,
    "signatureReady": true,
    "agreementCompleted": true,
    "mediatorAvailability": true,
    "productUpdates": true
  }'::jsonb;

-- 4. Account deactivation audit trail ----------------------------------------
--
-- `usuarios.activo` already exists and nothing ever toggled it. Deactivation has
-- to be attributable and reversible, so record when it was requested rather than
-- only flipping a boolean. NULL means never requested.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS desactivacion_solicitada_at TIMESTAMPTZ;

-- Rollback:
--   DROP TRIGGER IF EXISTS trigger_assign_caso_codigo ON casos;
--   DROP FUNCTION IF EXISTS public.assign_caso_codigo();
--   DROP INDEX IF EXISTS casos_codigo_unique, notificaciones_usuario_no_leidas;
--   ALTER TABLE casos DROP COLUMN IF EXISTS codigo;
--   ALTER TABLE notificaciones DROP COLUMN IF EXISTS leido_at;
--   ALTER TABLE usuarios DROP COLUMN IF EXISTS preferencias_notificacion,
--     DROP COLUMN IF EXISTS desactivacion_solicitada_at;
