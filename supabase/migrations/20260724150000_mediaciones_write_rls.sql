-- ============================================================
-- Proyecto Mediación — Migration: Mediaciones write RLS
-- Fecha: 2026-07-24
-- RN/CA: RN-05 (mediación), PM decision #3 (una parte puede solicitar)
-- Rollback: DROP POLICY mediaciones_insert_own, mediaciones_update_mediator ON mediaciones;
-- ============================================================

-- ============================================================
-- MEDIACIONES — INSERT/UPDATE policies
-- Solo existía SELECT; falta escritura para workflow de mediación.
-- ============================================================

-- INSERT: una parte del caso puede solicitar mediación
CREATE POLICY mediaciones_insert_own ON mediaciones
  FOR INSERT WITH CHECK (
    is_part_of_case(caso_id)
    AND mediador_id != auth.uid()
  );

-- UPDATE: el mediador asignado puede aceptar/rechazar
CREATE POLICY mediaciones_update_mediator ON mediaciones
  FOR UPDATE USING (
    mediador_id = auth.uid()
    OR is_admin()
  );
