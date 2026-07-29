-- ============================================================
-- PASO 9: Test unique caso_partes + integridad FK
-- ============================================================

-- Intentar agregar a Parte A dos veces al mismo caso (debería fallar)
DO $$
BEGIN
  INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion, fecha_union)
  VALUES (
    (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'),
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'parte_a',
    'aceptada',
    now()
  );
  RAISE NOTICE 'ERROR: unique constraint no funcionó';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: unique rechazó parte duplicada - %', SQLERRM;
END $$;

-- Verificar integridad: no se puede crear item en caso inexistente
DO $$
BEGIN
  INSERT INTO items (caso_id, parte_id, categoria, nombre, valor_min, valor_max)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'economico',
    'Item fantasma',
    '100',
    '200'
  );
  RAISE NOTICE 'ERROR: FK constraint no funcionó';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: FK rechazó caso inexistente - %', SQLERRM;
END $$;

-- Resumen final de la DB
SELECT '--- RESUMEN ---' AS seccion;
SELECT 'Tablas con datos:' AS info, relname, n_live_tup AS filas
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 0
ORDER BY relname;
