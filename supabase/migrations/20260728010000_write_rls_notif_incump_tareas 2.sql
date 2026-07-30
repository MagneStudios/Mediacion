-- ============================================================
-- Proyecto Mediación — Migration: RLS write policies
-- Fecha: 2026-07-28
-- RN/CA: Consistencia — todas las tablas con RLS SELECT también tienen INSERT/UPDATE
-- Rollback: DROP POLICY notificaciones_insert_own, notificaciones_update_own,
--           incumplimientos_insert_own, incumplimientos_update_own,
--           tareas_insert_own, tareas_update_own ON ...;
-- ============================================================

-- ============================================================
-- NOTIFICACIONES — INSERT/UPDATE
-- Backend inserta vía kysely (bypasea RLS por ser superuser),
-- pero estas policies habilitan uso futuro desde app o edge functions.
-- ============================================================

CREATE POLICY notificaciones_insert_own ON notificaciones
  FOR INSERT WITH CHECK (
    usuario_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY notificaciones_update_own ON notificaciones
  FOR UPDATE USING (
    usuario_id = auth.uid()
    OR is_admin()
  );

-- ============================================================
-- INCUMPLIMIENTOS — INSERT/UPDATE
-- Una parte del caso puede registrar un incumplimiento.
-- ============================================================

CREATE POLICY incumplimientos_insert_own ON incumplimientos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM acuerdos a
      WHERE a.id = acuerdo_id
        AND (is_part_of_case(a.caso_id) OR is_admin())
    )
  );

CREATE POLICY incumplimientos_update_own ON incumplimientos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM acuerdos a
      WHERE a.id = acuerdo_id
        AND (is_part_of_case(a.caso_id) OR is_admin())
    )
  );

-- ============================================================
-- TAREAS — INSERT/UPDATE
-- Partes del caso o admin pueden crear tareas.
-- ============================================================

CREATE POLICY tareas_insert_own ON tareas
  FOR INSERT WITH CHECK (
    is_part_of_case(caso_id)
    OR is_admin()
  );

CREATE POLICY tareas_update_own ON tareas
  FOR UPDATE USING (
    is_part_of_case(caso_id)
    OR is_admin()
  );
