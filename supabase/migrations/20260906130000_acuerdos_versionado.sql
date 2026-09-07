-- ============================================================
-- Proyecto Mediación — Migration 42 (Parte 5, aditiva): versionado
-- de acuerdos (renegociación).
-- Fecha: 2026-09-06
-- RN/CA: Decisión §5.2 — versionado con intención explícita:
--        version INT, supersedes_agreement_id, vigente, valid_from.
--        NO se agrega miembro a estado_acuerdo (evita que el front
--        renderice "reemplazado" como "borrador" en sus ternarios).
-- Reglas: aditivo puro (solo ADD COLUMN + CREATE INDEX). No tocar
--         estado_acuerdo. Sin commit.
-- ============================================================
-- Rollback (por columna):
--   ALTER TABLE acuerdos DROP COLUMN version;
--   ALTER TABLE acuerdos DROP COLUMN supersedes_agreement_id;
--   ALTER TABLE acuerdos DROP COLUMN vigente;
--   ALTER TABLE acuerdos DROP COLUMN valid_from;
--   DROP INDEX idx_acuerdos_negociacion_vigente;

ALTER TABLE acuerdos ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE acuerdos ADD COLUMN IF NOT EXISTS supersedes_agreement_id UUID REFERENCES acuerdos(id);

ALTER TABLE acuerdos ADD COLUMN IF NOT EXISTS vigente BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE acuerdos ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_acuerdos_negociacion_vigente
  ON acuerdos (negociacion_id, vigente);