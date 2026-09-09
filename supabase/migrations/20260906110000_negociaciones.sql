-- ============================================================
-- Proyecto Mediación — Migration 40 (Parte 3): tabla negociaciones
-- Fecha: 2026-09-06
-- RN/CA: Acuerdos modulares — "1 caso = N negociaciones por materia".
--        ADITIVO puro: no rompe el path actual caso→acuerdos.
-- Reglas: sin DROP ni ALTER COLUMN TYPE; ADD COLUMN nullable en items.
--         GRANTs explícitos por objeto (filosofía del repo).
-- Rollbacks documentados por sección.
-- ============================================================

-- ============================================================
-- 1. ENUMS nuevos
-- ============================================================
-- Rollback: DROP TYPE materia_acuerdo; DROP TYPE estado_negociacion; (CASCADE)

CREATE TYPE materia_acuerdo AS ENUM ('tenencia', 'alimentos', 'bienes', 'otro');

CREATE TYPE estado_negociacion AS ENUM ('borrador', 'activa', 'acordada', 'cerrada', 'terminada');

-- ============================================================
-- 2. TABLA negociaciones
-- ============================================================
-- Rollback: DROP TABLE negociaciones CASCADE;

CREATE TABLE negociaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  materia materia_acuerdo,
  method metodo_caso NOT NULL,
  estado estado_negociacion NOT NULL DEFAULT 'borrador',
  round INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT negociaciones_caso_materia_unique UNIQUE (caso_id, materia)
);

CREATE INDEX idx_negociaciones_caso ON negociaciones (caso_id);
CREATE INDEX idx_negociaciones_materia ON negociaciones (materia);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON negociaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. ITEMS: negociacion_id nullable (backfill en Parte 4)
-- ============================================================
-- Rollback: ALTER TABLE items DROP COLUMN negociacion_id;

ALTER TABLE items ADD COLUMN IF NOT EXISTS negociacion_id UUID REFERENCES negociaciones(id);

-- ============================================================
-- 4. RLS negociaciones
--    Patrón casos/items: partes del caso + admin. Escritura de
--    participantes permitida (un partícipe crea/edita sus
--    negociaciones); el gate de estados lo controla el BE.
-- ============================================================
-- Rollback: DROP POLICY negociaciones_all ON negociaciones;
--           ALTER TABLE negociaciones DISABLE ROW LEVEL SECURITY;

ALTER TABLE negociaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY negociaciones_all ON negociaciones
  FOR ALL USING (
    is_part_of_case(caso_id)
    OR is_admin()
  );

-- ============================================================
-- 5. GRANTS explícitos (filosofía del repo, sin ALTER DEFAULT PRIVILEGES)
-- ============================================================
-- Rollback: REVOKE ALL ON negociaciones FROM authenticated, anon,
--           service_role, postgres;

GRANT SELECT, INSERT, UPDATE, DELETE ON negociaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON negociaciones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON negociaciones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON negociaciones TO postgres;