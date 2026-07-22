-- TEST D: Tests de Cascade + Notificaciones

-- D1: ¿Eliminar un usuario elimina sus items en cascade?

-- Crear un usuario temporal con items
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-9999-9999-999999999999',
  'authenticated', 'authenticated',
  'cascade_test@test.com', crypt('test123', gen_salt('bf')),
  now(), now(), now(),
  '{"nombre": "Cascade", "apellido": "Test"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Crear item para ese usuario
INSERT INTO items (caso_id, parte_id, categoria, nombre, valor_min, valor_max, privado)
SELECT id, '99999999-9999-9999-9999-999999999999', 'economico', 'Item cascade', '0', '100', true
FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Verificar que el item existe
SELECT COUNT(*) AS items_antes FROM items WHERE parte_id = '99999999-9999-9999-9999-999999999999';

-- Eliminar el usuario de auth.users (ON DELETE CASCADE)
DELETE FROM auth.users WHERE id = '99999999-9999-9999-9999-999999999999';

-- Verificar que el item desapareció
SELECT COUNT(*) AS items_despues FROM items WHERE parte_id = '99999999-9999-9999-9999-999999999999';
-- Esperado: items_antes = 1, items_despues = 0

---------------------

-- D2: ¿Las notificaciones se crean correctamente?

-- Crear notificación de prueba
INSERT INTO notificaciones (usuario_id, caso_id, canal, evento, estado)
SELECT
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  id,
  'email',
  'Test notificación',
  'pendiente'
FROM casos WHERE nombre = 'Custodia de hijos menores';

-- Verificar que la parte A puede ver su notificación
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT evento, canal, estado FROM notificaciones
WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

RESET role;
RESET request.jwt.claims;
-- Esperado: 1 notificación visible

---------------------------------

-- D3: ¿RLS en notificaciones bloquea a otros usuarios?

-- Parte B NO debería ver la notificación de Parte A
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

SELECT COUNT(*) AS notificaciones_visibles FROM notificaciones;

RESET role;
RESET request.jwt.claims;
-- Esperado: 0 (solo ve las suyas, que no tiene)

---------------------------------

--D4: ¿Los roles de Supabase Auth (authenticated, anon, service_role) tienen los grants correctos?

-- Verificar grants en una tabla clave
SELECT grantee, privilege_type, table_name
FROM information_schema.table_privileges
WHERE table_name = 'items'
AND grantee IN ('authenticated', 'anon', 'service_role')
ORDER BY grantee, privilege_type;

-- Esperado: SELECT, INSERT, UPDATE, DELETE para los 3 roles