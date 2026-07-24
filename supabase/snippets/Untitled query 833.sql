--  TEST A: Consistencia del Schema

-- A1: ¿Se puede crear un caso sin ser parte del mismo?
-- Como usuario NO vinculado al caso, intentar insertar un item
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

-- Non-member intenta crear item en un caso que no es suyo
INSERT INTO items (caso_id, parte_id, categoria, nombre, valor_min, valor_max, privado)
SELECT
  id, 'd0000000-0000-0000-0000-000000000004', 'economico', 'Intento fraude', '0', '1000', true
FROM casos WHERE nombre = 'Custodia de hijos menores';

RESET role;
RESET request.jwt.claims;

-- Resultado esperado: ERROR (RLS INSERT policy requiere parte_id = auth.uid() AND is_part_of_case)


--------------

-- A2: ¿Un parte puede ver/actualizar el perfil de otro?

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Parte A intenta ver perfil de Parte B
SELECT id, email, nombre, apellido FROM usuarios
WHERE id = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Parte A intenta UPDATE el email de Parte B
UPDATE usuarios SET email = 'hacked@test.com'
WHERE id = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

RESET role;
RESET request.jwt.claims;

-- SELECT esperado: 0 rows (solo ve el propio)
-- UPDATE esperado: 0 rows updated (RLS solo permite UPDATE WHERE id = auth.uid())

--------------------

-- A3: ¿CHECK XOR funciona correctamente con suscripciones?

-- Intentar crear suscripción con AMBOS usuario_id Y estudio_id NULL → debe fallar
DO $$
BEGIN
  INSERT INTO suscripciones (usuario_id, estudio_id, plan_id, estado)
  VALUES (NULL, NULL, (SELECT id FROM planes LIMIT 1), 'pendiente_pago');
  RAISE NOTICE 'ERROR: Ambos NULL fue aceptado!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Rechazado - %', SQLERRM;
END $$;

-- Intentar crear suscripción con AMBOS usuario_id Y estudio_id NOT NULL → debe fallar
DO $$
BEGIN
  INSERT INTO suscripciones (usuario_id, estudio_id, plan_id, estado)
  VALUES (
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (SELECT id FROM estudios LIMIT 1),
    (SELECT id FROM planes LIMIT 1),
    'pendiente_pago'
  );
  RAISE NOTICE 'ERROR: Ambos NOT NULL fue aceptado!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Rechazado - %', SQLERRM;
END $$;

--------------

-- A4: ¿Transiciones inválidas del caso están bloqueadas?

-- Crear caso nuevo
INSERT INTO casos (creador_id, nombre, metodo)
VALUES ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test transiciones', 'mediacion');

-- Transiciones VÁLIDAS (deberían funcionar)
UPDATE casos SET estado = 'activo' WHERE nombre = 'Test transiciones';
UPDATE casos SET estado = 'en_negociacion' WHERE nombre = 'Test transiciones';

-- Transiciones INVÁLIDAS (deberían fallar)
DO $$
BEGIN
  UPDATE casos SET estado = 'nuevo' WHERE nombre = 'Test transiciones';
  RAISE NOTICE 'ERROR: en_negociacion → nuevo aceptada!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: en_negociacion → nuevo rechazada - %', SQLERRM;
END $$;

DO $$
BEGIN
  UPDATE casos SET estado = 'activo' WHERE nombre = 'Test transiciones';
  RAISE NOTICE 'ERROR: en_negociacion → activo aceptada!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: en_negociacion → activo rechazada - %', SQLERRM;
END $$;

-- Terminal states: cerrado/terminado/vencido no deberían cambiar
UPDATE casos SET estado = 'acordado' WHERE nombre = 'Test transiciones';
UPDATE casos SET estado = 'cerrado' WHERE nombre = 'Test transiciones';

DO $$
BEGIN
  UPDATE casos SET estado = 'activo' WHERE nombre = 'Test transiciones';
  RAISE NOTICE 'ERROR: cerrado → activo aceptada!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: cerrado → activo rechazada - %', SQLERRM;
END $$;

------------------

-- A5: ¿La función handle_new_user funciona correctamente?

-- Verificar que TODOS los usuarios en auth.users tienen su par en public.usuarios
SELECT
  au.id AS auth_id,
  au.email,
  pu.id AS public_id,
  pu.rol,
  pu.nombre,
  pu.apellido
FROM auth.users au
LEFT JOIN usuarios pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- Resultado esperado: 0 rows (todos los auth.users tienen su registro en usuarios)

---------------

-- A6: ¿sync_ronda_actual funciona correctamente?

-- Crear rondas de prueba para los casos existentes
INSERT INTO rondas (caso_id, numero, estado)
SELECT id, 1, 'completada'
FROM casos WHERE nombre IN ('Custodia de hijos menores', 'Caso aislado');

INSERT INTO rondas (caso_id, numero, estado)
SELECT id, 2, 'activa'
FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Verificar sync
SELECT
  c.nombre,
  c.ronda_actual AS actual,
  MAX(r.numero) AS max_ronda,
  (c.ronda_actual = MAX(r.numero)) AS sincronizado
FROM casos c
LEFT JOIN rondas r ON r.caso_id = c.id
GROUP BY c.nombre, c.ronda_actual;


-- Verificar que ronda_actual coincide con la última ronda insertada
SELECT
  c.nombre,
  c.ronda_actual AS actual,
  (SELECT MAX(r.numero) FROM rondas r WHERE r.caso_id = c.id) AS max_ronda,
  (c.ronda_actual = (SELECT MAX(r.numero) FROM rondas r WHERE r.caso_id = c.id)) AS sincronizado
FROM casos c;

-- Resultado esperado: sincronizado = true para todos los casos


-----------
SELECT nombre, estado FROM casos WHERE nombre = 'Test transiciones';
-- Esperado: estado = 'cerrado'