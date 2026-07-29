-- ============================================================
-- PASO 11: Test Helper Functions para RLS
-- Verificar is_part_of_case, is_mediator_of_case, is_admin, etc.
-- Requiere: test_10_rls_deep.sql (crea mediador, admin, non-member)
-- ============================================================

-- ============================================================
-- 11A: is_part_of_case — Parte A SÍ es parte
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT 'Parte A is_part_of_case:' AS info,
  is_part_of_case((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')) AS result;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 11B: is_part_of_case — Non-member NO es parte
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT 'Non-member is_part_of_case:' AS info,
  is_part_of_case((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')) AS result;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 11C: is_mediator_of_case — Mediator SÍ es mediador
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "c0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT 'Mediator is_mediator_of_case:' AS info,
  is_mediator_of_case((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')) AS result;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 11D: is_mediator_of_case — Parte A NO es mediador
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT 'Parte A is_mediator_of_case (should be false):' AS info,
  is_mediator_of_case((SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores')) AS result;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 11E: is_admin — Admin SÍ es admin
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT 'Admin is_admin:' AS info, is_admin() AS result;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 11F: is_admin — Parte A NO es admin
-- ============================================================

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT 'Parte A is_admin (should be false):' AS info, is_admin() AS result;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 11G: is_estudio — para usuario de rol estudio
-- ============================================================

DO $d$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated',
    'estudio@test.com', crypt('test123', gen_salt('bf')),
    now(), now(), now(),
    '{"nombre": "Estudio", "apellido": "Test", "rol": "estudio"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb
  );
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'OK: usuario estudio ya existe (re-run seguro)';
END $d$;

UPDATE usuarios
SET estudio_id = (SELECT id FROM estudios LIMIT 1)
WHERE id = 'e0000000-0000-0000-0000-000000000005';

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "e0000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT 'Estudio user is_estudio:' AS info, is_estudio() AS result;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 11H: is_own_subscription
-- ============================================================

INSERT INTO suscripciones (usuario_id, plan_id, estado)
SELECT 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 'activa'
FROM planes WHERE nombre = 'base';

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT 'Parte A is_own_subscription:' AS info,
  is_own_subscription((SELECT id FROM suscripciones WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa' LIMIT 1)) AS result;

RESET role;
RESET request.jwt.claims;

-- Non-member no puede ver la suscripcion de Parte A
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT 'Non-member sees Parte A subscription (should be 0):' AS info,
  COUNT(*) AS total
FROM suscripciones
WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

RESET role;
RESET request.jwt.claims;
