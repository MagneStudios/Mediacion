-- ============================================================
-- PASO 7: Test auditoría (RNF-10) + updated_at
-- ============================================================

-- Actualizar el caso (debería disparar audit + updated_at)
UPDATE casos
SET descripcion = 'Acuerdo de custodia compartida - actualizado'
WHERE nombre = 'Custodia de hijos menores';

-- Verificar auditoría
SELECT accion, entidad, entidad_id IS NOT NULL AS tiene_entidad_id,
       detalle ? 'before' AS tiene_before, detalle ? 'after' AS tiene_after
FROM auditoria
WHERE entidad = 'casos'
ORDER BY created_at DESC
LIMIT 3;

-- Verificar updated_at se actualizó
SELECT 'updated_at actualizado:' AS info,
       created_at, updated_at,
       updated_at > created_at AS updated_es_reciente
FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Verificar auditoría de items
SELECT accion, entidad
FROM auditoria
WHERE entidad = 'items';
