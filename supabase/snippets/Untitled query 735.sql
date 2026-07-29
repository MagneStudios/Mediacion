-- ============================================================
-- PASO 10: RLS Profundo — Mediator, Admin, Non-member
-- Requiere: test_01_setup.sql + test_02_caso.sql + test_03_items.sql
-- ============================================================

-- ============================================================
-- 10A: Setup — crear mediador y usuario no-miembro
-- ============================================================

-- Mediador
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated',
  'mediador@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Carlos", "apellido": "Ruiz", "rol": "mediador"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Usuario NO miembro del caso
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000004',
  'authenticated', 'authenticated',
  'no_parte@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Ana", "apellido": "Torres"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Admin", "apellido": "System", "rol": "admin"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Verificar roles
SELECT id, email, rol FROM usuarios ORDER BY email;

-- ============================================================
-- 10B: Vincular mediador al caso
-- ============================================================

INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
SELECT id, 'c0000000-0000-0000-0000-000000000003', 'mediador', 'aceptada'
FROM casos WHERE nombre = 'Custodia de hijos menores';

-- ============================================================
-- 10C: Mediator VE items de AMBAS partes
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "c0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT 'Mediator items count:' AS info,
  COUNT(*) AS total
FROM items
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores');

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 10D: Non-member NO ve NADA del caso
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT 'Non-member items count:' AS info,
  COUNT(*) AS total
FROM items
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores');

SELECT 'Non-member casos count:' AS info,
  COUNT(*) AS total
FROM casos;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 10E: Admin VE todo
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT 'Admin items count:' AS info,
  COUNT(*) AS total
FROM items;

SELECT 'Admin casos count:' AS info,
  COUNT(*) AS total
FROM casos;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 10F: Mediator NO ve items de otros casos
-- ============================================================

INSERT INTO casos (creador_id, nombre, metodo)
VALUES ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Caso aislado', 'negociacion');

INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion)
SELECT id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'parte_a', 'aceptada'
FROM casos WHERE nombre = 'Caso aislado';

INSERT INTO items (caso_id, parte_id, categoria, nombre, valor_min, valor_max)
SELECT id, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'economico', 'Pension', '200', '500'
FROM casos WHERE nombre = 'Caso aislado';

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "c0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT 'Mediator items in Caso aislado (should be 0):' AS info,
  COUNT(*) AS total
FROM items
WHERE caso_id = (SELECT id FROM casos WHERE nombre = 'Caso aislado');

RESET role;
RESET request.jwt.claims;
