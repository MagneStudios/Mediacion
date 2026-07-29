-- ============================================================
-- PASO 5: Test máquina de estados del caso (§5)
-- ============================================================

-- Transición válida: nuevo → activo (debería funcionar)
UPDATE casos
SET estado = 'activo'
WHERE nombre = 'Custodia de hijos menores';

SELECT 'nuevo → activo:' AS transicion, estado FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Transición válida: activo → en_negociacion
UPDATE casos
SET estado = 'en_negociacion'
WHERE nombre = 'Custodia de hijos menores';

SELECT 'activo → en_negociacion:' AS transicion, estado FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Transición INVÁLIDA: en_negociacion → nuevo (debería fallar)
DO $$
BEGIN
  UPDATE casos SET estado = 'nuevo' WHERE nombre = 'Custodia de hijos menores';
  RAISE NOTICE 'ERROR: La transición inválida fue aceptada!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Transición rechazada - %', SQLERRM;
END $$;

SELECT 'estado actual:' AS info, estado FROM casos WHERE nombre = 'Custodia de hijos menores';
