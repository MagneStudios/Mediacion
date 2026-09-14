-- ============================================================
-- Proyecto Mediación — Migration 45 (aditiva): is_self_serve en planes.
-- Fecha: 2026-09-10
-- Decisión: docs/decisiones-db/2026-09-10-planes-self-serve.md
--   true  = plan self-serve (el alta puede contratarlo; incluye base gratis
--           y planes de pago).
--   false = "a consultar" (corporativo): se contrata por ventas, no por
--           el wizard del alta.
-- Aditiva: no toca RLS, no crea suscripciones, no modifica handle_new_user,
--          no modifica precio ni otras columnas de planes.
-- ============================================================
-- Rollback:
--   ALTER TABLE planes DROP COLUMN is_self_serve;

ALTER TABLE planes ADD COLUMN is_self_serve BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN planes.is_self_serve IS
  'true = plan self-serve (el alta puede contratarlo; incluye base gratis y planes de pago). '
  'false = "a consultar" (corporativo): se contrata por ventas, no por el wizard del alta.';

UPDATE planes SET is_self_serve = false WHERE nombre = 'corporativo';