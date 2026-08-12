-- ============================================================
-- Proyecto Mediación — Migration: fix linter PERF multiple policies
-- Fecha: 2026-08-11
-- Origen: docs/prompts-db/correccion-warnings-linter-supabase.md (Bloque 2)
--  Consolidar multi-policy SELECT (misma tabla/rol/acción) en 1 sola con OR
--  en firmas, items, notificaciones y usuarios.
--  Devuelven los mismos resultados que las policies separadas.
--  - is_admin() como InitPlan: (SELECT is_admin()) — se conserva la optimización.
--  - firmas_select conserva el branch is_admin() que tenía firmas_select_case.
-- Reglas: aditivas en resultado neto. search_path = '' intacto (no se crean funciones).
-- Rollback: ver comentarios por sección.
-- ============================================================

-- ============================================================
-- 1. FIRMAS
--    Antes: firmas_select_case + firmas_select_own
--    Después: 1 policy SELECT (own | part_of_case | admin)
-- ============================================================

DROP POLICY IF EXISTS firmas_select_case ON firmas;
DROP POLICY IF EXISTS firmas_select_own ON firmas;
CREATE POLICY firmas_select ON firmas
  FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    OR is_part_of_case(
      (SELECT acuerdos.caso_id FROM acuerdos WHERE acuerdos.id = firmas.acuerdo_id)
    )
    OR (SELECT is_admin())
  );
-- Rollback: ver policies originales en 20260721191704_rls_policie.sql /
--           20260728210000_rls_auth_initplan.sql.

-- ============================================================
-- 2. ITEMS
--    Antes: items_select_admin + items_select_mediator + items_select_own
--    Después: 1 policy SELECT (admin | mediator | own)
-- ============================================================

DROP POLICY IF EXISTS items_select_admin ON items;
DROP POLICY IF EXISTS items_select_mediator ON items;
DROP POLICY IF EXISTS items_select_own ON items;
CREATE POLICY items_select ON items
  FOR SELECT TO authenticated
  USING (
    (SELECT is_admin())
    OR is_mediator_of_case(caso_id)
    OR parte_id = (SELECT auth.uid())
  );
-- Rollback: ver policies originales en 20260721191704_rls_policie.sql /
--           20260728210000_rls_auth_initplan.sql.

-- ============================================================
-- 3. NOTIFICACIONES
--    Antes: notificaciones_select_admin + notificaciones_select_own
--    Después: 1 policy SELECT (admin | own)
-- ============================================================

DROP POLICY IF EXISTS notificaciones_select_admin ON notificaciones;
DROP POLICY IF EXISTS notificaciones_select_own ON notificaciones;
CREATE POLICY notificaciones_select ON notificaciones
  FOR SELECT TO authenticated
  USING (
    (SELECT is_admin())
    OR usuario_id = (SELECT auth.uid())
  );
-- Rollback: ver policies originales en 20260721191704_rls_policie.sql /
--           20260728210000_rls_auth_initplan.sql.

-- ============================================================
-- 4. USUARIOS
--    Antes: usuarios_select_admin + usuarios_select_own
--    Después: 1 policy SELECT (admin | own)
-- ============================================================

DROP POLICY IF EXISTS usuarios_select_admin ON usuarios;
DROP POLICY IF EXISTS usuarios_select_own ON usuarios;
CREATE POLICY usuarios_select ON usuarios
  FOR SELECT TO authenticated
  USING (
    (SELECT is_admin())
    OR id = (SELECT auth.uid())
  );
-- Rollback: ver policies originales en 20260721191704_rls_policie.sql /
--           20260728210000_rls_auth_initplan.sql.
