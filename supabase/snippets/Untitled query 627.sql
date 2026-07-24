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


-- ========================================
-- TEST SEED: Planes
-- ========================================

-- Verificar los 4 planes
SELECT nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio,
       CASE WHEN limite_carpetas = -1 THEN 'ilimitado' ELSE limite_carpetas::text END AS carpetas,
       CASE WHEN limite_casos = -1 THEN 'ilimitado' ELSE limite_casos::text END AS casos
FROM planes ORDER BY precio;

-- Verificar que el nombre es único (intentar duplicar)
-- Debería fallar:
-- INSERT INTO planes (nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio)
-- VALUES ('base', 1, 1, 1, 0);


-- ========================================
-- TEST SEED: Configuración
-- ========================================

-- Verificar las 5 configs del sistema
SELECT clave, valor, pg_typeof(valor) AS tipo, descripcion
FROM configuracion ORDER BY clave;

-- Verificar que la clave es única (intentar duplicar)
-- Debería fallar:
-- INSERT INTO configuracion (clave, valor, descripcion)
-- VALUES ('ia_modelo', '"test"', 'duplicado');


-- ========================================
-- TEST SEED: Verificar que los planes se referencian correctamente
-- ========================================

-- Un usuario puede suscribirse a un plan
INSERT INTO suscripciones (usuario_id, plan_id, estado)
VALUES (
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (SELECT id FROM planes WHERE nombre = 'base'),
  'pendiente_pago'
);

SELECT s.estado, p.nombre AS plan, p.precio
FROM suscripciones s
JOIN planes p ON p.id = s.plan_id;