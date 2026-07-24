-- TEST C Edge Cases Profundos

-- C1: ¿El trigger handle_new_user copia el rol del metadata correctamente?

-- Crear usuario con rol explícito en metadata
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'rol_test@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Test", "apellido": "Rol", "rol": "mediador"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Verificar que el trigger asignó 'mediador'
SELECT email, rol FROM usuarios WHERE email = 'rol_test@test.com';
-- Esperado: rol = 'mediador'

-- Crear usuario SIN rol en metadata → debería defaultear a 'parte'
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated',
  'default_rol@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Default", "apellido": "Rol"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

SELECT email, rol FROM usuarios WHERE email = 'default_rol@test.com';
-- Esperado: rol = 'parte'

--------------------------

-- C2: ¿Unique constraint en caso_partes previene duplicados?


-- Intentar agregar a Parte B dos veces al mismo caso
DO $$
BEGIN
  INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
  SELECT id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'parte_b', 'aceptada'
  FROM casos WHERE nombre = 'Custodia de hijos menores';
  RAISE NOTICE 'ERROR: Duplicado aceptado!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Duplicado rechazado - %', SQLERRM;
END $$;

------------------------

-- C3: ¿Unique constraint en respuestas_propuesta previene doble respuesta?

-- Primero necesitamos una propuesta existente
-- Crear ronda y propuesta para Custodia
INSERT INTO rondas (caso_id, numero, estado)
SELECT id, 3, 'activa'
FROM casos WHERE nombre = 'Custodia de hijos menores'
ON CONFLICT DO NOTHING;

INSERT INTO propuestas (caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia)
SELECT c.id, r.id, '{"test": true}', 'Test', 'pendiente', 'test'
FROM casos c
JOIN rondas r ON r.caso_id = c.id AND r.numero = 3
WHERE c.nombre = 'Custodia de hijos menores';

-- Parte A responde una vez
INSERT INTO respuestas_propuesta (propuesta_id, parte_id, decision)
SELECT p.id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'acepta'
FROM propuestas p
JOIN casos c ON c.id = p.caso_id
WHERE c.nombre = 'Custodia de hijos menores' AND p.estado = 'pendiente';

-- Parte A intenta responder de nuevo → debería fallar
DO $$
BEGIN
  INSERT INTO respuestas_propuesta (propuesta_id, parte_id, decision)
  SELECT p.id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rechaza'
  FROM propuestas p
  JOIN casos c ON c.id = p.caso_id
  WHERE c.nombre = 'Custodia de hijos menores' AND p.estado = 'pendiente';
  RAISE NOTICE 'ERROR: Doble respuesta aceptada!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: Doble respuesta rechazada - %', SQLERRM;
END $$;

--------------------------

-- C4: ¿El update_updated_at se dispara correctamente?

-- Hacer un UPDATE en un caso y verificar que updated_at cambió
UPDATE casos SET descripcion = 'Test updated_at' WHERE nombre = 'Custodia de hijos menores';

SELECT
  nombre,
  created_at,
  updated_at,
  (updated_at > created_at) AS updated_mayor
FROM casos WHERE nombre = 'Custodia de hijos menores';
-- Esperado: updated_mayor = true


-----------------------------

-- C5: ¿RLS funciona para UPDATE de perfil ajeno?

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Parte A intenta cambiar el teléfono de Parte B
UPDATE usuarios SET telefono = '1234567890'
WHERE id = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Verificar que no cambió
RESET role;
SELECT telefono FROM usuarios WHERE id = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Esperado: NULL (sin cambios)

RESET role;
RESET request.jwt.claims;

------------------------------

-- C6: ¿La tabla planes es legible para todos?

-- Como parte
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT nombre, precio, limite_casos FROM planes ORDER BY precio;

RESET role;
RESET request.jwt.claims;

-- Esperado: 4 planes visibles