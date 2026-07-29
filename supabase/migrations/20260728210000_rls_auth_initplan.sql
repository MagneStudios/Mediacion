-- ============================================================
-- Proyecto Mediación — Migration: Fix auth_rls_initplan warnings
-- Fecha: 2026-07-28
-- Performance: wrap auth.uid() in (SELECT auth.uid()) to avoid
--   per-row re-evaluation in RLS policies.
-- Refs: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

-- ============================================================
-- USUARIOS
-- ============================================================

DROP POLICY IF EXISTS usuarios_select_own ON usuarios;
CREATE POLICY usuarios_select_own ON usuarios
  FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS usuarios_update_own ON usuarios;
CREATE POLICY usuarios_update_own ON usuarios
  FOR UPDATE USING (id = (SELECT auth.uid()));

-- ============================================================
-- ESTUDIOS
-- ============================================================

DROP POLICY IF EXISTS estudios_select_own ON estudios;
CREATE POLICY estudios_select_own ON estudios
  FOR SELECT USING (
    id = (SELECT estudio_id FROM usuarios WHERE id = (SELECT auth.uid()))
    OR is_admin()
  );

-- ============================================================
-- CARPETAS
-- ============================================================

DROP POLICY IF EXISTS carpetas_select_own ON carpetas;
CREATE POLICY carpetas_select_own ON carpetas
  FOR SELECT USING (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = (SELECT auth.uid()))
    OR is_admin()
  );

DROP POLICY IF EXISTS carpetas_insert_own ON carpetas;
CREATE POLICY carpetas_insert_own ON carpetas
  FOR INSERT WITH CHECK (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = (SELECT auth.uid()))
    OR is_admin()
  );

DROP POLICY IF EXISTS carpetas_update_own ON carpetas;
CREATE POLICY carpetas_update_own ON carpetas
  FOR UPDATE USING (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = (SELECT auth.uid()))
    OR is_admin()
  );

DROP POLICY IF EXISTS carpetas_delete_own ON carpetas;
CREATE POLICY carpetas_delete_own ON carpetas
  FOR DELETE USING (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = (SELECT auth.uid()))
    OR is_admin()
  );

-- ============================================================
-- CASOS
-- ============================================================

DROP POLICY IF EXISTS casos_insert_own ON casos;
CREATE POLICY casos_insert_own ON casos
  FOR INSERT WITH CHECK (creador_id = (SELECT auth.uid()));

-- ============================================================
-- ITEMS
-- ============================================================

DROP POLICY IF EXISTS items_select_own ON items;
CREATE POLICY items_select_own ON items
  FOR SELECT USING (parte_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS items_insert_own ON items;
CREATE POLICY items_insert_own ON items
  FOR INSERT WITH CHECK (
    parte_id = (SELECT auth.uid())
    AND is_part_of_case(caso_id)
  );

DROP POLICY IF EXISTS items_update_own ON items;
CREATE POLICY items_update_own ON items
  FOR UPDATE USING (parte_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS items_delete_own ON items;
CREATE POLICY items_delete_own ON items
  FOR DELETE USING (parte_id = (SELECT auth.uid()));

-- ============================================================
-- RESPUESTAS_PROPUESTA
-- ============================================================

DROP POLICY IF EXISTS respuestas_insert ON respuestas_propuesta;
CREATE POLICY respuestas_insert ON respuestas_propuesta
  FOR INSERT WITH CHECK (parte_id = (SELECT auth.uid()));

-- ============================================================
-- MEDIACIONES
-- ============================================================

DROP POLICY IF EXISTS mediaciones_select ON mediaciones;
CREATE POLICY mediaciones_select ON mediaciones
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR mediador_id = (SELECT auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS mediaciones_insert_own ON mediaciones;
CREATE POLICY mediaciones_insert_own ON mediaciones
  FOR INSERT WITH CHECK (
    is_part_of_case(caso_id)
    AND mediador_id != (SELECT auth.uid())
  );

DROP POLICY IF EXISTS mediaciones_update_mediator ON mediaciones;
CREATE POLICY mediaciones_update_mediator ON mediaciones
  FOR UPDATE USING (
    mediador_id = (SELECT auth.uid())
    OR is_admin()
  );

-- ============================================================
-- FIRMAS
-- ============================================================

DROP POLICY IF EXISTS firmas_select_own ON firmas;
CREATE POLICY firmas_select_own ON firmas
  FOR SELECT USING (usuario_id = (SELECT auth.uid()));

-- ============================================================
-- NOTIFICACIONES
-- ============================================================

DROP POLICY IF EXISTS notificaciones_select_own ON notificaciones;
CREATE POLICY notificaciones_select_own ON notificaciones
  FOR SELECT USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notificaciones_insert_own ON notificaciones;
CREATE POLICY notificaciones_insert_own ON notificaciones
  FOR INSERT WITH CHECK (
    usuario_id = (SELECT auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS notificaciones_update_own ON notificaciones;
CREATE POLICY notificaciones_update_own ON notificaciones
  FOR UPDATE USING (
    usuario_id = (SELECT auth.uid())
    OR is_admin()
  );

-- ============================================================
-- PAGOS
-- ============================================================

DROP POLICY IF EXISTS pagos_select_own ON pagos;
CREATE POLICY pagos_select_own ON pagos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM suscripciones s
      WHERE s.id = suscripcion_id
        AND (s.usuario_id = (SELECT auth.uid()) OR is_admin())
    )
  );
