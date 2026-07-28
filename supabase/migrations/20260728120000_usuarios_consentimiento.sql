-- ============================================================
-- Proyecto Mediación — Migration: Consentimiento de identidad
-- Fecha: 2026-07-28
-- RN/CA: POST /auth/consentimiento (firma de identidad DocuSign + consentimiento)
-- Rollback: Ver comentarios por columna
-- ============================================================

-- ============================================================
-- COLUMNS
-- ============================================================

-- Momento en que el usuario firmó el consentimiento de identidad
ALTER TABLE usuarios
  ADD COLUMN consentimiento_fecha TIMESTAMPTZ;
-- Rollback: ALTER TABLE usuarios DROP COLUMN IF EXISTS consentimiento_fecha;

-- Envelope de DocuSign que respalda esa firma
ALTER TABLE usuarios
  ADD COLUMN consentimiento_envelope_id TEXT;
-- Rollback: ALTER TABLE usuarios DROP COLUMN IF EXISTS consentimiento_envelope_id;
