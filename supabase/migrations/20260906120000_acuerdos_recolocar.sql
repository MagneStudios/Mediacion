-- ============================================================
-- Proyecto Mediación — Migration 41 (Parte 4, BREAKING): recolocar
-- rondas/propuestas/acuerdos/items bajo negociacion_id.
-- Fecha: 2026-09-06
-- RN/CA: Acuerdos modulares — un caso puede tener N negociaciones por
--        materia, cada una con sus rondas/propuestas/acuerdos.
-- ANUNCIADO: cae acuerdos_caso_unique, rondas_caso_numero_unique,
--            propuestas_caso_ronda_unique, casos.ronda_actual,
--            sync_ronda_actual() y su trigger.
-- ============================================================
-- MOVIMIENTO (todas las operaciones idempotentes):
--  1. Mapeo caso→negociación: crea una negociacion con materia=NULL
--     ("modelo viejo") para todo caso sin negociaciones.
--  2. acuerdos / rondas / propuestas: ADD COLUMN negociacion_id
--     (nullable) → backfill → SET NOT NULL → FK → UNIQUE nuevo.
--  3. items: backfill negociacion_id (queda nullable, decisión C-01/P3).
--  4. Casos: DROP ronda_actual + trigger + sync_ronda_actual().
--  5. RLS de rondas/propuestas/acuerdos resuelven el caso por negociación.
-- Mantené casos.caso_id en acuerdos/rondas/propuestas (queries caso-nivel).
-- ============================================================

-- ============================================================
-- 1. MAPEO CASO → NEGOCIACIÓN (+ creación 'otro' cuando falta)
-- ============================================================

DROP TABLE IF EXISTS tmp_caso_neg_map;

-- 1a. Negociaciones faltantes: 1 por caso, materia=NULL = "modelo viejo".
INSERT INTO negociaciones (caso_id, materia, method, estado, round)
SELECT c.id, NULL, COALESCE(c.metodo, 'negociacion'), 'borrador', 1
FROM casos c
WHERE NOT EXISTS (
  SELECT 1 FROM negociaciones n WHERE n.caso_id = c.id
);

-- 1b. Mapa de referencia: para cada caso, la negociación que aloja los datos viejos
--     (preferimos la fila legacy con materia=NULL).
CREATE TEMP TABLE tmp_caso_neg_map AS
SELECT DISTINCT ON (c.id)
       c.id AS caso_id,
       n.id AS negociacion_id
FROM casos c
JOIN negociaciones n ON n.caso_id = c.id
ORDER BY c.id, (n.materia IS NULL) DESC, n.created_at ASC;

-- ============================================================
-- 2. ACUERDOS
-- ============================================================
-- Rollback: ALTER TABLE acuerdos DROP COLUMN negociacion_id CASCADE;

ALTER TABLE acuerdos ADD COLUMN IF NOT EXISTS negociacion_id UUID;

UPDATE acuerdos a
SET negociacion_id = m.negociacion_id
FROM tmp_caso_neg_map m
WHERE a.negociacion_id IS NULL
  AND a.caso_id = m.caso_id;

ALTER TABLE acuerdos ALTER COLUMN negociacion_id SET NOT NULL;

ALTER TABLE acuerdos DROP CONSTRAINT IF EXISTS acuerdos_negociacion_id_fkey;
ALTER TABLE acuerdos ADD CONSTRAINT acuerdos_negociacion_id_fkey
  FOREIGN KEY (negociacion_id) REFERENCES negociaciones(id);

ALTER TABLE acuerdos DROP CONSTRAINT IF EXISTS acuerdos_caso_unique;

-- ============================================================
-- 3. RONDAS
-- ============================================================
-- Rollback: ALTER TABLE rondas DROP COLUMN negociacion_id CASCADE;

ALTER TABLE rondas ADD COLUMN IF NOT EXISTS negociacion_id UUID;

UPDATE rondas r
SET negociacion_id = m.negociacion_id
FROM tmp_caso_neg_map m
WHERE r.negociacion_id IS NULL
  AND r.caso_id = m.caso_id;

ALTER TABLE rondas ALTER COLUMN negociacion_id SET NOT NULL;

ALTER TABLE rondas DROP CONSTRAINT IF EXISTS rondas_negociacion_id_fkey;
ALTER TABLE rondas ADD CONSTRAINT rondas_negociacion_id_fkey
  FOREIGN KEY (negociacion_id) REFERENCES negociaciones(id);

ALTER TABLE rondas DROP CONSTRAINT IF EXISTS rondas_caso_numero_unique;
ALTER TABLE rondas DROP CONSTRAINT IF EXISTS rondas_negociacion_numero_unique;
ALTER TABLE rondas ADD CONSTRAINT rondas_negociacion_numero_unique
  UNIQUE (negociacion_id, numero);
CREATE INDEX IF NOT EXISTS idx_rondas_caso ON rondas (caso_id);

-- ============================================================
-- 4. PROPUESTAS
-- ============================================================
-- Rollback: ALTER TABLE propuestas DROP COLUMN negociacion_id CASCADE;

ALTER TABLE propuestas ADD COLUMN IF NOT EXISTS negociacion_id UUID;

UPDATE propuestas p
SET negociacion_id = r.negociacion_id
FROM rondas r
WHERE p.negociacion_id IS NULL
  AND p.ronda_id = r.id;

ALTER TABLE propuestas ALTER COLUMN negociacion_id SET NOT NULL;

ALTER TABLE propuestas DROP CONSTRAINT IF EXISTS propuestas_negociacion_id_fkey;
ALTER TABLE propuestas ADD CONSTRAINT propuestas_negociacion_id_fkey
  FOREIGN KEY (negociacion_id) REFERENCES negociaciones(id);

ALTER TABLE propuestas DROP CONSTRAINT IF EXISTS propuestas_caso_ronda_unique;
ALTER TABLE propuestas DROP CONSTRAINT IF EXISTS propuestas_negociacion_ronda_unique;
ALTER TABLE propuestas ADD CONSTRAINT propuestas_negociacion_ronda_unique
  UNIQUE (negociacion_id, ronda_id);
CREATE INDEX IF NOT EXISTS idx_propuestas_caso ON propuestas (caso_id);

-- ============================================================
-- 5. ITEMS — backfill (la columna queda NULLABLE, no se fuerza NOT NULL)
-- ============================================================
-- Rollback: ninguna (columna de Parte 3; el backfill es data).

UPDATE items i
SET negociacion_id = m.negociacion_id
FROM tmp_caso_neg_map m
WHERE i.negociacion_id IS NULL
  AND i.caso_id = m.caso_id;

-- ============================================================
-- 6. RETIRAR CONTADOR DE CASO (ronda se lee de negociaciones.round)
-- ============================================================
-- Rollback: CREATE FUNCTION sync_ronda_actual() + trigger + backfill
--           ronda_actual desde MAX(rondas.numero).

ALTER TABLE casos DROP COLUMN IF EXISTS ronda_actual;

DROP TRIGGER IF EXISTS trigger_sync_ronda_actual ON rondas;
DROP FUNCTION IF EXISTS sync_ronda_actual();

-- ============================================================
-- 7. RLS: rondas/propuestas/acuerdos resuelven el caso por negociación
-- ============================================================
-- Rollback: ver definiciones previas en 20260721191704_rls_policie.sql /
--           20260729190000_is_admin_initplan.sql.

DROP POLICY IF EXISTS rondas_select ON rondas;
CREATE POLICY rondas_select ON rondas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM negociaciones n
      WHERE n.id = rondas.negociacion_id
        AND (is_part_of_case(n.caso_id)
             OR is_mediator_of_case(n.caso_id)
             OR (SELECT is_admin()))
    )
  );

DROP POLICY IF EXISTS propuestas_select ON propuestas;
CREATE POLICY propuestas_select ON propuestas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM negociaciones n
      WHERE n.id = propuestas.negociacion_id
        AND (is_part_of_case(n.caso_id)
             OR is_mediator_of_case(n.caso_id)
             OR (SELECT is_admin()))
    )
  );

DROP POLICY IF EXISTS propuestas_insert ON propuestas;
CREATE POLICY propuestas_insert ON propuestas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM negociaciones n
      WHERE n.id = propuestas.negociacion_id
        AND is_part_of_case(n.caso_id)
    )
  );

DROP POLICY IF EXISTS acuerdos_select ON acuerdos;
CREATE POLICY acuerdos_select ON acuerdos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM negociaciones n
      WHERE n.id = acuerdos.negociacion_id
        AND (is_part_of_case(n.caso_id) OR (SELECT is_admin()))
    )
  );

-- ============================================================
-- 8. LIMPIEZA de la tabla temporal
-- ============================================================

DROP TABLE IF EXISTS tmp_caso_neg_map;