-- ============================================================
-- PASO 6: Test CHECK constraint XOR en suscripciones
-- ============================================================

-- Crear usuario y estudio de prueba
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'cccc3333-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'estudio@test.com', crypt('test123', gen_salt('bf')), now(), now(), now(), '{"nombre": "Estudio", "apellido": "Test"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb);

INSERT INTO estudios (nombre, plan_id) VALUES ('Estudio Jurídico Test', (SELECT id FROM planes WHERE nombre = 'estudio'));

-- CASO OK: usuario_id NO NULL, estudio_id NULL
INSERT INTO suscripciones (usuario_id, plan_id, estado)
VALUES ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (SELECT id FROM planes WHERE nombre = 'base'), 'activa');
SELECT 'OK: solo usuario_id' AS test, id FROM suscripciones WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- CASO OK: estudio_id NO NULL, usuario_id NULL
INSERT INTO suscripciones (estudio_id, plan_id, estado)
VALUES ((SELECT id FROM estudios WHERE nombre = 'Estudio Jurídico Test'), (SELECT id FROM planes WHERE nombre = 'estudio'), 'activa');
SELECT 'OK: solo estudio_id' AS test, id FROM suscripciones WHERE estudio_id IS NOT NULL;

-- CASO FAIL: ambos NO NULL (debería fallar por CHECK)
DO $$
BEGIN
  INSERT INTO suscripciones (usuario_id, estudio_id, plan_id, estado)
  VALUES ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (SELECT id FROM estudios LIMIT 1), (SELECT id FROM planes WHERE nombre = 'base'), 'activa');
  RAISE NOTICE 'ERROR: CHECK constraint no funcionó';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: CHECK rechazó ambos NO NULL - %', SQLERRM;
END $$;

-- CASO FAIL: ambos NULL (debería fallar por CHECK)
DO $$
BEGIN
  INSERT INTO suscripciones (usuario_id, estudio_id, plan_id, estado)
  VALUES (NULL, NULL, (SELECT id FROM planes WHERE nombre = 'base'), 'activa');
  RAISE NOTICE 'ERROR: CHECK constraint no funcionó';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK: CHECK rechazó ambos NULL - %', SQLERRM;
END $$;
