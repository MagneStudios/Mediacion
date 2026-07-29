-- ============================================================
-- PASO 14: Regression — Bug #4.1 transición activo → en_negociacion
-- Valida que el UPDATE con WHERE estado = 'activo' funciona
-- y es idempotente.
-- Requiere: test_01_setup.sql
-- ============================================================

-- ============================================================
-- 14A: Crear caso nuevo y activarlo
-- ============================================================

DO $d$
DECLARE
  v_caso_id uuid;
  v_rows integer;
BEGIN
  INSERT INTO casos (creador_id, nombre, descripcion, metodo, estado)
  VALUES (
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Test Bug #4.1 — Transicion activo a en_negociacion',
    'Caso creado especificamente para validar la correccion del bug',
    'mediacion',
    'nuevo'
  )
  RETURNING id INTO v_caso_id;

  RAISE NOTICE 'OK: Caso creado con id %', v_caso_id;

  -- Activar caso
  UPDATE casos SET estado = 'activo' WHERE id = v_caso_id;
  RAISE NOTICE 'OK: Caso activado';

  -- Verificar estado actual
  IF (SELECT estado FROM casos WHERE id = v_caso_id) != 'activo' THEN
    RAISE EXCEPTION 'FAIL: Estado deberia ser activo, era %', (SELECT estado FROM casos WHERE id = v_caso_id);
  END IF;
  RAISE NOTICE 'OK: Estado confirmado = activo';

  -- ============================================================
  -- 14B: Agregar ambas partes
  -- ============================================================

  INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
  VALUES (v_caso_id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'parte_a', 'aceptada');

  INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
  VALUES (v_caso_id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'parte_b', 'aceptada');

  RAISE NOTICE 'OK: Partes agregadas';

  -- ============================================================
  -- 14C: Crear items (posiciones) para ambas partes
  -- ============================================================

  INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
  VALUES (v_caso_id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'economico',
    'Pension', 'Monto mensual', '500', '700', false, true);

  INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
  VALUES (v_caso_id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'economico',
    'Pension', 'Monto mensual', '300', '400', false, true);

  RAISE NOTICE 'OK: Items creados (ambas partes tienen posicion)';

  -- ============================================================
  -- 14D: Transicion activo → en_negociacion (simula generatePropuesta)
  --      UPDATE con WHERE estado = 'activo' — DEBE afectar 1 fila
  -- ============================================================

  UPDATE casos SET estado = 'en_negociacion'
  WHERE id = v_caso_id AND estado = 'activo';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL: Transicion activo→en_negociacion afecto % filas, se esperaba 1', v_rows;
  END IF;
  RAISE NOTICE 'OK: activo→en_negociacion afecto 1 fila (v_rows=%)', v_rows;

  -- Verificar estado final
  IF (SELECT estado FROM casos WHERE id = v_caso_id) != 'en_negociacion' THEN
    RAISE EXCEPTION 'FAIL: Estado deberia ser en_negociacion, era %', (SELECT estado FROM casos WHERE id = v_caso_id);
  END IF;
  RAISE NOTICE 'OK: Estado final = en_negociacion';

  -- ============================================================
  -- 14E: Idempotencia — repetir el mismo UPDATE debe afectar 0 filas
  --      (el WHERE estado = 'activo' ya no matchea)
  -- ============================================================

  UPDATE casos SET estado = 'en_negociacion'
  WHERE id = v_caso_id AND estado = 'activo';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL: Segunda ejecucion deberia afectar 0 filas, afecto %', v_rows;
  END IF;
  RAISE NOTICE 'OK: Idempotente — segunda ejecucion afecto 0 filas';

  -- ============================================================
  -- 14F: Limpieza
  -- ============================================================

  DELETE FROM items WHERE caso_id = v_caso_id;
  DELETE FROM caso_partes WHERE caso_id = v_caso_id;
  DELETE FROM casos WHERE id = v_caso_id;

  RAISE NOTICE 'OK: Datos de test limpiados';

  -- ============================================================
  -- RESUMEN
  -- ============================================================

  RAISE NOTICE '=== TEST 14: BUG #4.1 REGRESSION — PASS ===';
  RAISE NOTICE '1. Caso creado y activado: OK';
  RAISE NOTICE '2. Partes agregadas: OK';
  RAISE NOTICE '3. Items (posiciones) creados: OK';
  RAISE NOTICE '4. Transicion activo→en_negociacion: OK (1 fila)';
  RAISE NOTICE '5. Idempotencia: OK (0 filas en segunda ejecucion)';
END $d$;
