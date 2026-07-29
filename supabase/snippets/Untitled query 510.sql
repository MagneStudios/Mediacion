-- ============================================================
-- SETUP: Crear 2 usuarios de prueba vía auth.users
-- ============================================================

-- Parte A
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated',
  'partea@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Juan", "apellido": "Garcia"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Parte B
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated', 'authenticated',
  'parteb@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Maria", "apellido": "Lopez"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Verificar que el trigger creó los registros en public.usuarios
SELECT id, rol, nombre, apellido, email FROM usuarios ORDER BY email;
