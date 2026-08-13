-- ============================================================
-- Proyecto Mediación — Migration: fix linter SECURITY WARN
-- Fecha: 2026-08-11
-- Origen: docs/prompts-db/correccion-warnings-linter-supabase.md (Bloque 1)
--  1) REVOKE EXECUTE de funciones de trigger a PUBLIC/anon/authenticated.
--     (assign_caso_codigo, audit_trigger_func, handle_new_user)
--     Los triggers corren con permisos del dueño de la tabla, no del rol
--     que dispara la operación: ningún rol del request necesita EXECUTE.
--  2) Helpers RLS (is_admin, is_estudio, is_mediator_of_case,
--     is_own_subscription, is_owner_estudio_of_case, is_part_of_case):
--     REVOKE de PUBLIC y anon, GRANT a authenticated y service_role.
--     NOTA (desvío del plan verificado empíricamente): en PostgreSQL 17
--     las policies RLS se evalúan con los permisos del rol que ejecuta la
--     query, NO del dueño de la tabla. REVOKE a authenticated rompe las
--     policies que llaman a estos helpers. Se bloquea anon/PUBLIC (cierra
--     el RPC anónimo) y se conserva EXECUTE para authenticated (policies)
--     y service_role (API).
--  3) inversores_insert_anon: WITH CHECK (true) → validación básica de nombre/email.
-- Reglas: aditiva / REVOKE idempotente. No crea funciones nuevas.
-- Rollback: re-grantear EXECUTE a PUBLIC + recrear inversores_insert_anon con WITH CHECK (true).
-- ============================================================

-- ============================================================
-- 1. REVOKE EXECUTE a funciones de trigger
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.assign_caso_codigo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_func() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- Rollback: GRANT EXECUTE ON FUNCTION public.assign_caso_codigo() TO PUBLIC;
--           GRANT EXECUTE ON FUNCTION public.audit_trigger_func() TO PUBLIC;
--           GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;

-- ============================================================
-- 2. Helpers RLS — bloquear anon/PUBLIC, mantener authenticated
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_estudio() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_mediator_of_case(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_own_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_estudio_of_case(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_part_of_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_estudio() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_mediator_of_case(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_own_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_estudio_of_case(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_part_of_case(uuid) TO authenticated, service_role;
-- Rollback: GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;
--           GRANT EXECUTE ON FUNCTION public.is_estudio() TO PUBLIC;
--           GRANT EXECUTE ON FUNCTION public.is_mediator_of_case(uuid) TO PUBLIC;
--           GRANT EXECUTE ON FUNCTION public.is_own_subscription(uuid) TO PUBLIC;
--           GRANT EXECUTE ON FUNCTION public.is_owner_estudio_of_case(uuid) TO PUBLIC;
--           GRANT EXECUTE ON FUNCTION public.is_part_of_case(uuid) TO PUBLIC;

-- ============================================================
-- 3. inversores_insert_anon — hardening mínimo
--    La SELECT de inversores no se toca.
-- ============================================================

DROP POLICY IF EXISTS inversores_insert_anon ON inversores;
CREATE POLICY inversores_insert_anon ON inversores
  FOR INSERT TO anon
  WITH CHECK (
    nombre IS NOT NULL
    AND length(trim(nombre)) > 0
    AND email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );
-- Rollback: DROP POLICY inversores_insert_anon ON inversores;
--           CREATE POLICY inversores_insert_anon ON inversores
--             FOR INSERT WITH CHECK (true);
