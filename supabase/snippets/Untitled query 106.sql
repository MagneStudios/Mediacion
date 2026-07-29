-- ============================================================
-- PASO 12: Flujo E2E Completo
-- Caso nuevo → activo → en_negociacion → acordado → cerrado
-- Requiere: test_01_setup.sql (usuarios) + test_10_rls_deep.sql
-- (mediador, admin)
-- ============================================================

-- ============================================================
-- 12A: Crear caso nuevo con las partes
-- ============================================================

INSERT INTO casos (creador_id, nombre, descripcion, metodo, estado)
VALUES (
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Divorcio mutuo acuerdo',
  'Pareja con 2 hijos menores, division de bienes',
  'mediacion',
  'nuevo'
);

SELECT 'Caso creado:' AS info, id, estado FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- Partes al caso
INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
SELECT id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'parte_a', 'aceptada'
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
SELECT id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'parte_b', 'aceptada'
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- 12B: Activar caso
-- ============================================================

UPDATE casos SET estado = 'activo' WHERE nombre = 'Divorcio mutuo acuerdo';
SELECT 'Caso activado:' AS info, estado FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- 12C: Crear items para ambas partes
-- ============================================================

INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
SELECT
  id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cuidado_ninos',
  'Guardia de hijos', 'Quien tiene la guarda principal', 'Compartida', 'Parte A',
  true, true
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
SELECT
  id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cuidado_ninos',
  'Guardia de hijos', 'Quien tiene la guarda principal', 'Parte B', 'Compartida',
  true, true
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
SELECT
  id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'economico',
  'Pension alimenticia', 'Monto mensual para manutencion', '300', '500',
  false, true
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, privado)
SELECT
  id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'economico',
  'Pension alimenticia', 'Monto mensual para manutencion', '200', '400',
  false, true
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

SELECT 'Items creados:' AS info, COUNT(*) AS total FROM items
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo');

-- ============================================================
-- 12D: Crear Ronda 1
-- ============================================================

INSERT INTO rondas (caso_id, numero, estado)
SELECT id, 1, 'activa'
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

SELECT 'Ronda actual despues de insert ronda 1:' AS info, ronda_actual
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- 12E: Crear propuesta IA en Ronda 1
-- ============================================================

INSERT INTO propuestas (caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia)
SELECT
  c.id, r.id,
  '{"guardia": "compartida", "pension": 350, "vacaciones": "alternas"}'::jsonb,
  'Propuesta basada en intereses de ambas partes',
  'pendiente', 'openai/gpt-4'
FROM casos c
JOIN rondas r ON r.caso_id = c.id AND r.numero = 1
WHERE c.nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- 12F: Partes responden a la propuesta
-- ============================================================

INSERT INTO respuestas_propuesta (propuesta_id, parte_id, decision)
SELECT p.id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'acepta'
FROM propuestas p
JOIN casos c ON c.id = p.caso_id
WHERE c.nombre = 'Divorcio mutuo acuerdo';

INSERT INTO respuestas_propuesta (propuesta_id, parte_id, decision)
SELECT p.id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'acepta'
FROM propuestas p
JOIN casos c ON c.id = p.caso_id
WHERE c.nombre = 'Divorcio mutuo acuerdo';

SELECT 'Respuestas:' AS info, rp.decision, u.nombre
FROM respuestas_propuesta rp
JOIN usuarios u ON u.id = rp.parte_id
WHERE rp.propuesta_id = (SELECT id FROM propuestas WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo'));

-- ============================================================
-- 12G: Cerrar Ronda 1, avanzar a Ronda 2
-- ============================================================

UPDATE rondas SET estado = 'completada', fecha_fin = now()
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo') AND numero = 1;

INSERT INTO rondas (caso_id, numero, estado)
SELECT id, 2, 'activa'
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

SELECT 'Ronda actual:' AS info, ronda_actual
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- 12H: Transicionar a en_negociacion
-- ============================================================

UPDATE casos SET estado = 'en_negociacion' WHERE nombre = 'Divorcio mutuo acuerdo';
SELECT 'Caso en negociacion:' AS info, estado FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- 12I: Solicitar mediación (RN-05)
-- ============================================================

INSERT INTO mediaciones (caso_id, mediador_id, estado, ronda)
SELECT id, 'c0000000-0000-0000-0000-000000000003', 'solicitada', 2
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

UPDATE mediaciones SET estado = 'aceptada', fecha_aceptacion = now()
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo')
  AND mediador_id = 'c0000000-0000-0000-0000-000000000003';

SELECT 'Mediacion:' AS info, estado FROM mediaciones
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo');

-- ============================================================
-- 12J: Crear acuerdo
-- ============================================================

INSERT INTO acuerdos (caso_id, contenido, estado, fecha)
VALUES (
  (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo'),
  '{"guardia": "compartida", "pension": 350, "vacaciones": "alternas", "detalle": "Acuerdo completo"}'::jsonb,
  'borrador',
  now()
);

-- ============================================================
-- 12K: Crear firmas
-- ============================================================

INSERT INTO firmas (acuerdo_id, usuario_id, docusign_status)
SELECT a.id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pending'
FROM acuerdos a WHERE a.caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo');

INSERT INTO firmas (acuerdo_id, usuario_id, docusign_status)
SELECT a.id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pending'
FROM acuerdos a WHERE a.caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo');

UPDATE firmas SET docusign_status = 'signed', fecha_firma = now()
WHERE acuerdo_id = (SELECT id FROM acuerdos WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo'))
  AND usuario_id IN ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ============================================================
-- 12L: Crear tareas del acuerdo
-- ============================================================

INSERT INTO tareas (acuerdo_id, caso_id, tipo, descripcion, fecha_evento, estado)
SELECT
  a.id, a.caso_id, 'tarea',
  'Tramitar cambio de guardia en Registro Civil',
  now() + interval '15 days', 'pendiente'
FROM acuerdos a WHERE a.caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo');

INSERT INTO tareas (acuerdo_id, caso_id, tipo, descripcion, fecha_evento, estado)
SELECT
  a.id, a.caso_id, 'evento_calendario',
  'Primer pago de pension alimenticia',
  now() + interval '30 days', 'pendiente'
FROM acuerdos a WHERE a.caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo');

-- ============================================================
-- 12M: Crear notificación
-- ============================================================

INSERT INTO notificaciones (usuario_id, caso_id, canal, evento, estado)
VALUES (
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo'),
  'email',
  'Acuerdo listo para firmar',
  'pendiente'
);

-- ============================================================
-- 12N: Acordar y cerrar caso
-- ============================================================

UPDATE acuerdos SET estado = 'firmado', fecha = now()
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo');

UPDATE casos SET estado = 'acordado' WHERE nombre = 'Divorcio mutuo acuerdo';
UPDATE casos SET estado = 'cerrado' WHERE nombre = 'Divorcio mutuo acuerdo';

SELECT 'Caso cerrado:' AS info, estado FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- 12O: Verificar auditoría completa
-- ============================================================

SELECT 'Audit trail:' AS info, accion, entidad, created_at
FROM auditoria
WHERE entidad_id = (SELECT id FROM casos WHERE nombre = 'Divorcio mutuo acuerdo')
ORDER BY created_at
LIMIT 20;

-- ============================================================
-- 12P: Verificar update_at triggers funcionando
-- ============================================================

SELECT 'updated_at check:' AS info,
  created_at, updated_at,
  (updated_at >= created_at) AS updated_after_created
FROM casos WHERE nombre = 'Divorcio mutuo acuerdo';

-- ============================================================
-- RESUMEN FINAL DEL E2E
-- ============================================================

SELECT '=== RESUMEN E2E ===' AS seccion;

SELECT 'Casos:' AS tabla, COUNT(*) AS total FROM casos;
SELECT 'CasoPartes:' AS tabla, COUNT(*) AS total FROM caso_partes;
SELECT 'Items:' AS tabla, COUNT(*) AS total FROM items;
SELECT 'Rondas:' AS tabla, COUNT(*) AS total FROM rondas;
SELECT 'Propuestas:' AS tabla, COUNT(*) AS total FROM propuestas;
SELECT 'Respuestas:' AS tabla, COUNT(*) AS total FROM respuestas_propuesta;
SELECT 'Mediaciones:' AS tabla, COUNT(*) AS total FROM mediaciones;
SELECT 'Acuerdos:' AS tabla, COUNT(*) AS total FROM acuerdos;
SELECT 'Firmas:' AS tabla, COUNT(*) AS total FROM firmas;
SELECT 'Tareas:' AS tabla, COUNT(*) AS total FROM tareas;
SELECT 'Notificaciones:' AS tabla, COUNT(*) AS total FROM notificaciones;
SELECT 'Auditoria:' AS tabla, COUNT(*) AS total FROM auditoria;
SELECT 'Usuarios:' AS tabla, COUNT(*) AS total FROM usuarios;
SELECT 'Suscripciones:' AS tabla, COUNT(*) AS total FROM suscripciones;
