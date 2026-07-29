-- ============================================================
-- PASO 13: Tests para migraciones del backend (2026-07-23/24)
-- Requiere: test_01_setup.sql + test_02_caso.sql + test_10_rls_deep.sql
-- ============================================================

-- Crear rondas necesarias para los tests
INSERT INTO rondas (caso_id, numero, estado)
SELECT id, 1, 'activa' FROM casos WHERE nombre = 'Custodia de hijos menores'
ON CONFLICT DO NOTHING;

INSERT INTO rondas (caso_id, numero, estado)
SELECT id, 4, 'activa' FROM casos WHERE nombre = 'Custodia de hijos menores'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13A: UNIQUE acuerdos.caso_id — un caso solo un acuerdo
-- ============================================================

-- Crear primer acuerdo (deberia funcionar)
INSERT INTO acuerdos (caso_id, contenido, estado, fecha)
SELECT id, '{"test": 1}'::jsonb, 'borrador', now()
FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Intentar segundo acuerdo en el mismo caso (deberia fallar)
DO $d$
BEGIN
  INSERT INTO acuerdos (caso_id, contenido, estado, fecha)
  SELECT id, '{"test": 2}'::jsonb, 'borrador', now()
  FROM casos WHERE nombre = 'Custodia de hijos menores';
  RAISE NOTICE 'FAIL: Segundo acuerdo aceptado!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Segundo acuerdo rechazado - %', SQLERRM;
END $d$;

-- Verificar que solo hay 1 acuerdo
SELECT 'Acuerdos en Custodia:' AS info, COUNT(*) AS total
FROM acuerdos
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores');
-- Esperado: 1

-- ============================================================
-- 13B: UNIQUE propuestas(caso_id, ronda_id) — una propuesta por ronda
-- ============================================================

-- Crear primera propuesta en ronda 1 (deberia funcionar)
INSERT INTO propuestas (caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia)
SELECT c.id, r.id, '{"test": 1}'::jsonb, 'Test', 'pendiente', 'test'
FROM casos c
JOIN rondas r ON r.caso_id = c.id AND r.numero = 1
WHERE c.nombre = 'Custodia de hijos menores';

-- Intentar segunda propuesta en la misma ronda (deberia fallar)
DO $d$
BEGIN
  INSERT INTO propuestas (caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia)
  SELECT c.id, r.id, '{"test": 2}'::jsonb, 'Test duplicado', 'pendiente', 'test'
  FROM casos c
  JOIN rondas r ON r.caso_id = c.id AND r.numero = 1
  WHERE c.nombre = 'Custodia de hijos menores';
  RAISE NOTICE 'FAIL: Segunda propuesta en misma ronda aceptada!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Segunda propuesta rechazada - %', SQLERRM;
END $d$;

-- Verificar que solo hay 1 propuesta en ronda 1
SELECT 'Propuestas en ronda 1:' AS info, COUNT(*) AS total
FROM propuestas p
JOIN rondas r ON r.id = p.ronda_id
WHERE p.caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
  AND r.numero = 1;
-- Esperado: 1

-- ============================================================
-- 13C: validate_propuesta_estado_transition — maquina de estados
-- ============================================================

-- Transicion VALIDA: pendiente -> aceptada
UPDATE propuestas SET estado = 'aceptada'
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
  AND estado = 'pendiente';

SELECT 'Propuesta aceptada:' AS info, estado FROM propuestas
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores');
-- Esperado: estado = 'aceptada'

-- Crear otra propuesta para testear rechazo
INSERT INTO propuestas (caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia)
SELECT c.id, r.id, '{"test": "rechazo"}'::jsonb, 'Test rechazo', 'pendiente', 'test'
FROM casos c
JOIN rondas r ON r.caso_id = c.id AND r.numero = 4
WHERE c.nombre = 'Custodia de hijos menores';

-- Transicion VALIDA: pendiente -> rechazada
UPDATE propuestas SET estado = 'rechazada'
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
  AND ronda_id = (SELECT id FROM rondas WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores') AND numero = 4);

SELECT 'Propuesta ronda 4:' AS info, estado FROM propuestas
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
  AND ronda_id = (SELECT id FROM rondas WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores') AND numero = 4);
-- Esperado: rechazada

-- Transicion INVALIDA: rechazada -> aceptada (deberia fallar)
DO $d$
BEGIN
  UPDATE propuestas SET estado = 'aceptada'
  WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
    AND ronda_id = (SELECT id FROM rondas WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores') AND numero = 4);
  RAISE NOTICE 'FAIL: rechazada -> aceptada permitida!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: rechazada -> aceptada bloqueada - %', SQLERRM;
END $d$;

-- Transicion INVALIDA: aceptada -> pendiente (deberia fallar)
DO $d$
BEGIN
  UPDATE propuestas SET estado = 'pendiente'
  WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
    AND estado = 'aceptada';
  RAISE NOTICE 'FAIL: aceptada -> pendiente permitida!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: aceptada -> pendiente bloqueada - %', SQLERRM;
END $d$;

-- ============================================================
-- 13D: Mediaciones write RLS
-- ============================================================

-- Parte A puede solicitar mediacion
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

INSERT INTO mediaciones (caso_id, mediador_id, estado, ronda)
SELECT id, 'c0000000-0000-0000-0000-000000000003', 'solicitada', 4
FROM casos WHERE nombre = 'Custodia de hijos menores';

RESET role;
RESET request.jwt.claims;

-- Verificar que se creo
SELECT 'Mediacion creada por Parte A:' AS info, estado FROM mediaciones
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
  AND ronda = 4;
-- Esperado: solicitada

-- Mediator puede aceptar
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "c0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

UPDATE mediaciones SET estado = 'aceptada', fecha_aceptacion = now()
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
  AND ronda = 4;

RESET role;
RESET request.jwt.claims;

SELECT 'Mediacion aceptada por mediador:' AS info, estado FROM mediaciones
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')
  AND ronda = 4;
-- Esperado: aceptada

-- Non-member NO puede crear mediacion
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

DO $d$
BEGIN
  INSERT INTO mediaciones (caso_id, mediador_id, estado, ronda)
  SELECT id, 'c0000000-0000-0000-0000-000000000003', 'solicitada', 5
  FROM casos WHERE nombre = 'Custodia de hijos menores';
  RAISE NOTICE 'FAIL: Non-member creo mediacion!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Non-member bloqueado - %', SQLERRM;
END $d$;

RESET role;
RESET request.jwt.claims;
