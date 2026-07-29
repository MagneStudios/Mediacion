-- ============================================================
-- PASO 8: Test sync ronda_actual + unique (caso_id, numero)
-- ============================================================

-- Crear ronda 1
INSERT INTO rondas (caso_id, numero, estado)
VALUES ((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'), 1, 'activa');

SELECT 'Después de crear ronda 1:' AS info, ronda_actual FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Crear ronda 2
INSERT INTO rondas (caso_id, numero, estado)
VALUES ((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'), 2, 'activa');

SELECT 'Después de crear ronda 2:' AS info, ronda_actual FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Crear ronda 3 (mediador habilitado)
INSERT INTO rondas (caso_id, numero, estado)
VALUES ((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'), 3, 'activa');

SELECT 'Después de crear ronda 3:' AS info, ronda_actual FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Intentar crear ronda duplicada (debería fallar por unique)
DO $$
BEGIN
  INSERT INTO rondas (caso_id, numero, estado)
  VALUES ((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'), 2, 'activa');
  RAISE NOTICE 'ERROR: unique constraint no funcionó';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: unique rechazó ronda duplicada - %', SQLERRM;
END $$;

-- Ver rondas creadas
SELECT numero, estado, fecha_inicio FROM rondas
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
ORDER BY numero;
