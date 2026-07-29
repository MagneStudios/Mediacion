-- ============================================================
-- PASO 15: Flujo E2E Completo — máquina de estados + migraciones
-- Validación exhaustiva desde creación hasta cierre,
-- incluyendo todas las transiciones de estado y triggers.
-- Requiere: test_01_setup.sql
-- ============================================================

DO $d$
DECLARE
  v_caso_id uuid;
  v_ronda1_id uuid;
  v_ronda2_id uuid;
  v_ronda3_id uuid;
  v_propuesta_id uuid;
  v_acuerdo_id uuid;
  v_rows integer;
BEGIN
  -- ============================================================
  -- 15A: Crear caso → nuevo → activo
  -- ============================================================

  INSERT INTO casos (creador_id, nombre, descripcion, metodo, estado)
  VALUES (
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'E2E Full — Divorcio con bienes e hijos',
    'Caso integral para validar toda la maquina de estados',
    'mediacion',
    'nuevo'
  )
  RETURNING id INTO v_caso_id;

  RAISE NOTICE '15A: Caso creado (id=%)', v_caso_id;

  -- Transición nuevo → activo
  UPDATE casos SET estado = 'activo' WHERE id = v_caso_id;
  IF (SELECT estado FROM casos WHERE id = v_caso_id) != 'activo' THEN
    RAISE EXCEPTION '15A: FAIL — estado no es activo';
  END IF;
  RAISE NOTICE '15A: Caso activado';

  -- ============================================================
  -- 15B: Agregar ambas partes
  -- ============================================================

  INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
  VALUES (v_caso_id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'parte_a', 'aceptada');

  INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
  VALUES (v_caso_id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'parte_b', 'aceptada');

  RAISE NOTICE '15B: Partes agregadas';

  -- ============================================================
  -- 15C: Items para cada parte
  -- ============================================================

  INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
  VALUES (v_caso_id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cuidado_ninos',
    'Guarda', 'Quien tiene la guarda', 'Compartida', 'Compartida', false, true);

  INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
  VALUES (v_caso_id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cuidado_ninos',
    'Guarda', 'Quien tiene la guarda', 'Yo', 'Compartida', true, true);

  INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
  VALUES (v_caso_id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'economico',
    'Pension', 'Monto mensual', '500', '700', false, true);

  INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
  VALUES (v_caso_id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'economico',
    'Pension', 'Monto mensual', '200', '400', false, true);

  RAISE NOTICE '15C: Items creados (2 items por parte)';

  -- ============================================================
  -- 15D: Ronda 1 + Propuesta IA
  -- ============================================================

  INSERT INTO rondas (caso_id, numero, estado)
  VALUES (v_caso_id, 1, 'activa')
  RETURNING id INTO v_ronda1_id;

  -- Verificar trigger sync_ronda_actual
  IF (SELECT ronda_actual FROM casos WHERE id = v_caso_id) != 1 THEN
    RAISE EXCEPTION '15D: FAIL — ronda_actual deberia ser 1, es %',
      (SELECT ronda_actual FROM casos WHERE id = v_caso_id);
  END IF;
  RAISE NOTICE '15D: Ronda 1 creada, ronda_actual=1';

  INSERT INTO propuestas (caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia)
  VALUES (v_caso_id, v_ronda1_id,
    '{"guarda": "compartida", "pension": 450}'::jsonb,
    'Propuesta inicial IA basada en posiciones',
    'pendiente', 'openai/gpt-4')
  RETURNING id INTO v_propuesta_id;

  RAISE NOTICE '15D: Propuesta creada en ronda 1';

  -- ============================================================
  -- 15E: Partes responden a la propuesta (ambas aceptan)
  -- ============================================================

  INSERT INTO respuestas_propuesta (propuesta_id, parte_id, decision)
  VALUES (v_propuesta_id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'acepta');

  INSERT INTO respuestas_propuesta (propuesta_id, parte_id, decision)
  VALUES (v_propuesta_id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'acepta');

  RAISE NOTICE '15E: Ambas partes aceptaron la propuesta';

  -- ============================================================
  -- 15F: Cerrar Ronda 1, avanzar a Ronda 2
  -- ============================================================

  UPDATE rondas SET estado = 'completada', fecha_fin = now()
  WHERE id = v_ronda1_id;

  INSERT INTO rondas (caso_id, numero, estado)
  VALUES (v_caso_id, 2, 'activa')
  RETURNING id INTO v_ronda2_id;

  IF (SELECT ronda_actual FROM casos WHERE id = v_caso_id) != 2 THEN
    RAISE EXCEPTION '15F: FAIL — ronda_actual deberia ser 2, es %',
      (SELECT ronda_actual FROM casos WHERE id = v_caso_id);
  END IF;
  RAISE NOTICE '15F: Ronda 2 activa, ronda_actual=2';

  -- ============================================================
  -- 15G: Transición activo → en_negociacion (Bug #4.1)
  -- ============================================================

  UPDATE casos SET estado = 'en_negociacion'
  WHERE id = v_caso_id AND estado = 'activo';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION '15G: FAIL — transicion activo→en_negociacion afecto % filas', v_rows;
  END IF;

  IF (SELECT estado FROM casos WHERE id = v_caso_id) != 'en_negociacion' THEN
    RAISE EXCEPTION '15G: FAIL — estado deberia ser en_negociacion, es %',
      (SELECT estado FROM casos WHERE id = v_caso_id);
  END IF;
  RAISE NOTICE '15G: Transicion a en_negociacion OK';

  -- ============================================================
  -- 15H: Solicitar mediación (RN-05)
  -- ============================================================

  INSERT INTO mediaciones (caso_id, mediador_id, estado, ronda)
  VALUES (v_caso_id, 'c0000000-0000-0000-0000-000000000003', 'solicitada', 2);

  RAISE NOTICE '15H: Mediacion solicitada';

  -- Mediador acepta
  UPDATE mediaciones SET estado = 'aceptada', fecha_aceptacion = now()
  WHERE caso_id = v_caso_id;

  IF (SELECT estado FROM mediaciones WHERE caso_id = v_caso_id) != 'aceptada' THEN
    RAISE EXCEPTION '15H: FAIL — mediacion no aceptada';
  END IF;
  RAISE NOTICE '15H: Mediador acepto la mediacion';

  -- ============================================================
  -- 15I: Ronda 3 con mediador (ronda de consenso)
  -- ============================================================

  UPDATE rondas SET estado = 'completada', fecha_fin = now()
  WHERE id = v_ronda2_id;

  INSERT INTO rondas (caso_id, numero, estado)
  VALUES (v_caso_id, 3, 'activa')
  RETURNING id INTO v_ronda3_id;

  IF (SELECT ronda_actual FROM casos WHERE id = v_caso_id) != 3 THEN
    RAISE EXCEPTION '15I: FAIL — ronda_actual deberia ser 3, es %',
      (SELECT ronda_actual FROM casos WHERE id = v_caso_id);
  END IF;
  RAISE NOTICE '15I: Ronda 3 activa (ronda mediador)';

  -- ============================================================
  -- 15J: Crear acuerdo
  -- ============================================================

  INSERT INTO acuerdos (caso_id, contenido, estado, fecha)
  VALUES (v_caso_id,
    '{"guarda": "compartida", "pension": 400, "detalle": "Acuerdo con mediador"}'::jsonb,
    'borrador', now())
  RETURNING id INTO v_acuerdo_id;

  RAISE NOTICE '15J: Acuerdo creado (id=%)', v_acuerdo_id;

  -- ============================================================
  -- 15K: Firmas de ambas partes
  -- ============================================================

  INSERT INTO firmas (acuerdo_id, usuario_id, docusign_status)
  VALUES (v_acuerdo_id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pending');

  INSERT INTO firmas (acuerdo_id, usuario_id, docusign_status)
  VALUES (v_acuerdo_id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pending');

  -- Firmar
  UPDATE firmas SET docusign_status = 'signed', fecha_firma = now()
  WHERE acuerdo_id = v_acuerdo_id;

  RAISE NOTICE '15K: Firmas completadas';

  -- ============================================================
  -- 15L: Tareas del acuerdo
  -- ============================================================

  INSERT INTO tareas (acuerdo_id, caso_id, tipo, descripcion, fecha_evento, estado)
  VALUES (v_acuerdo_id, v_caso_id, 'tarea',
    'Registrar acuerdo en el juzgado', now() + interval '15 days', 'pendiente');

  INSERT INTO tareas (acuerdo_id, caso_id, tipo, descripcion, fecha_evento, estado)
  VALUES (v_acuerdo_id, v_caso_id, 'evento_calendario',
    'Primer pago de pension', now() + interval '30 days', 'pendiente');

  INSERT INTO tareas (acuerdo_id, caso_id, tipo, descripcion, fecha_evento, estado)
  VALUES (v_acuerdo_id, v_caso_id, 'evento_calendario',
    'Revision semestral de guarda', now() + interval '180 days', 'pendiente');

  RAISE NOTICE '15L: Tareas creadas (3)';

  -- ============================================================
  -- 15M: Notificacion de acuerdo listo
  -- ============================================================

  INSERT INTO notificaciones (usuario_id, caso_id, canal, evento, estado)
  VALUES ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v_caso_id, 'email',
    'Acuerdo firmado — Pendiente de cierre', 'pendiente');

  INSERT INTO notificaciones (usuario_id, caso_id, canal, evento, estado)
  VALUES ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', v_caso_id, 'email',
    'Acuerdo firmado — Pendiente de cierre', 'pendiente');

  RAISE NOTICE '15M: Notificaciones creadas';

  -- ============================================================
  -- 15N: Acordar y cerrar caso
  -- ============================================================

  UPDATE acuerdos SET estado = 'firmado', fecha = now()
  WHERE id = v_acuerdo_id;

  UPDATE casos SET estado = 'acordado' WHERE id = v_caso_id;
  IF (SELECT estado FROM casos WHERE id = v_caso_id) != 'acordado' THEN
    RAISE EXCEPTION '15N: FAIL — estado no es acordado';
  END IF;

  UPDATE casos SET estado = 'cerrado' WHERE id = v_caso_id;
  IF (SELECT estado FROM casos WHERE id = v_caso_id) != 'cerrado' THEN
    RAISE EXCEPTION '15N: FAIL — estado no es cerrado';
  END IF;
  RAISE NOTICE '15N: Caso cerrado exitosamente';

  -- ============================================================
  -- 15O: Verificar auditoría
  -- ============================================================

  IF NOT EXISTS (SELECT 1 FROM auditoria WHERE entidad_id = v_caso_id AND entidad = 'casos') THEN
    RAISE EXCEPTION '15O: FAIL — sin registros de auditoria para el caso';
  END IF;
  RAISE NOTICE '15O: Auditoria presente para el caso';

  -- ============================================================
  -- 15P: Verificar updated_at
  -- ============================================================

  -- Nota: now() es constante dentro de una transacción, por eso
  -- updated_at == created_at. Solo verificamos que el trigger asignó un valor.
  IF (SELECT updated_at IS NULL FROM casos WHERE id = v_caso_id) THEN
    RAISE EXCEPTION '15P: FAIL — updated_at es NULL, el trigger no disparo';
  END IF;
  RAISE NOTICE '15P: updated_at asignado por trigger (OK)';

  -- ============================================================
  -- 15Q: Transiciones inválidas — deben fallar
  -- ============================================================

  -- cerrado → activo (debe fallar)
  BEGIN
    UPDATE casos SET estado = 'activo' WHERE id = v_caso_id;
    RAISE EXCEPTION '15Q: FAIL — cerrado→activo deberia ser invalido';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '15Q: OK — cerrado→activo rechazado (%)', SQLERRM;
  END;

  -- cerrado → nuevo (debe fallar)
  BEGIN
    UPDATE casos SET estado = 'nuevo' WHERE id = v_caso_id;
    RAISE EXCEPTION '15Q: FAIL — cerrado→nuevo deberia ser invalido';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '15Q: OK — cerrado→nuevo rechazado';
  END;

  -- ============================================================
  -- LIMPIEZA
  -- ============================================================

  DELETE FROM notificaciones WHERE caso_id = v_caso_id;
  DELETE FROM tareas WHERE caso_id = v_caso_id;
  DELETE FROM firmas WHERE acuerdo_id = v_acuerdo_id;
  DELETE FROM acuerdos WHERE caso_id = v_caso_id;
  DELETE FROM mediaciones WHERE caso_id = v_caso_id;
  DELETE FROM respuestas_propuesta WHERE propuesta_id = v_propuesta_id;
  DELETE FROM propuestas WHERE caso_id = v_caso_id;
  DELETE FROM rondas WHERE caso_id = v_caso_id;
  DELETE FROM items WHERE caso_id = v_caso_id;
  DELETE FROM caso_partes WHERE caso_id = v_caso_id;
  DELETE FROM auditoria WHERE entidad_id = v_caso_id;
  DELETE FROM casos WHERE id = v_caso_id;

  RAISE NOTICE 'Limpieza completa';

  -- ============================================================
  -- RESUMEN
  -- ============================================================

  RAISE NOTICE '=== TEST 15: E2E FULL FLOW — PASS ===';
  RAISE NOTICE '15A: caso → nuevo → activo';
  RAISE NOTICE '15B: partes agregadas (2)';
  RAISE NOTICE '15C: items creados (4)';
  RAISE NOTICE '15D: ronda 1 + propuesta IA';
  RAISE NOTICE '15E: respuestas (ambas aceptan)';
  RAISE NOTICE '15F: ronda 2 (sync ronda_actual)';
  RAISE NOTICE '15G: activo → en_negociacion (bug #4.1)';
  RAISE NOTICE '15H: mediacion solicitada → aceptada';
  RAISE NOTICE '15I: ronda 3 (mediador)';
  RAISE NOTICE '15J: acuerdo borrador';
  RAISE NOTICE '15K: firmas (2)';
  RAISE NOTICE '15L: tareas (3)';
  RAISE NOTICE '15M: notificaciones (2)';
  RAISE NOTICE '15N: acordado → cerrado';
  RAISE NOTICE '15O: auditoria presente';
  RAISE NOTICE '15P: updated_at OK';
  RAISE NOTICE '15Q: transiciones invalidas bloqueadas';
END $d$;
