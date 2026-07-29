-- ============================================================
-- Proyecto Mediación — Migration: is_admin() como InitPlan
-- Fecha: 2026-07-29
--
-- 20260728210000_rls_auth_initplan.sql envolvió auth.uid() pero dejó
-- is_admin() sin envolver. is_admin() es SECURITY DEFINER y consulta
-- public.usuarios, de modo que Postgres la reevalúa una vez por fila.
--
-- is_admin() no recibe argumentos: no depende de la fila, así que
-- (SELECT is_admin()) se promueve a InitPlan y se evalúa una sola vez.
--
-- Los helpers CON argumento —is_part_of_case(caso_id), is_mediator_of_case(),
-- is_owner_estudio_of_case(), is_own_subscription()— quedan intactos a
-- propósito: dependen de la fila, y envolverlos produciría un subplan
-- correlacionado que se evalúa por fila igual, sin ninguna ganancia.
--
-- Los predicados se reproducen tal cual están hoy en pg_policies: lo único
-- que cambia es el envoltorio de is_admin(). Ningún permiso se altera.
-- ============================================================


DROP POLICY IF EXISTS acuerdos_select ON acuerdos;
CREATE POLICY acuerdos_select ON acuerdos
  FOR SELECT
  USING ((is_part_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS auditoria_select_admin ON auditoria;
CREATE POLICY auditoria_select_admin ON auditoria
  FOR SELECT
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS carpetas_delete_own ON carpetas;
CREATE POLICY carpetas_delete_own ON carpetas
  FOR DELETE
  USING (((estudio_id = ( SELECT usuarios.estudio_id FROM usuarios WHERE (usuarios.id = (SELECT auth.uid())))) OR (SELECT is_admin())));

DROP POLICY IF EXISTS carpetas_insert_own ON carpetas;
CREATE POLICY carpetas_insert_own ON carpetas
  FOR INSERT
  WITH CHECK (((estudio_id = ( SELECT usuarios.estudio_id FROM usuarios WHERE (usuarios.id = (SELECT auth.uid())))) OR (SELECT is_admin())));

DROP POLICY IF EXISTS carpetas_select_own ON carpetas;
CREATE POLICY carpetas_select_own ON carpetas
  FOR SELECT
  USING (((estudio_id = ( SELECT usuarios.estudio_id FROM usuarios WHERE (usuarios.id = (SELECT auth.uid())))) OR (SELECT is_admin())));

DROP POLICY IF EXISTS carpetas_update_own ON carpetas;
CREATE POLICY carpetas_update_own ON carpetas
  FOR UPDATE
  USING (((estudio_id = ( SELECT usuarios.estudio_id FROM usuarios WHERE (usuarios.id = (SELECT auth.uid())))) OR (SELECT is_admin())));

DROP POLICY IF EXISTS caso_partes_select ON caso_partes;
CREATE POLICY caso_partes_select ON caso_partes
  FOR SELECT
  USING ((is_part_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS casos_select_part ON casos;
CREATE POLICY casos_select_part ON casos
  FOR SELECT
  USING ((is_part_of_case(id) OR is_owner_estudio_of_case(id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS configuracion_delete_admin ON configuracion;
CREATE POLICY configuracion_delete_admin ON configuracion
  FOR DELETE
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS configuracion_insert_admin ON configuracion;
CREATE POLICY configuracion_insert_admin ON configuracion
  FOR INSERT
  WITH CHECK ((SELECT is_admin()));

DROP POLICY IF EXISTS configuracion_select_admin ON configuracion;
CREATE POLICY configuracion_select_admin ON configuracion
  FOR SELECT
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS configuracion_update_admin ON configuracion;
CREATE POLICY configuracion_update_admin ON configuracion
  FOR UPDATE
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS estudios_select_own ON estudios;
CREATE POLICY estudios_select_own ON estudios
  FOR SELECT
  USING (((id = ( SELECT usuarios.estudio_id FROM usuarios WHERE (usuarios.id = (SELECT auth.uid())))) OR (SELECT is_admin())));

DROP POLICY IF EXISTS firmas_select_case ON firmas;
CREATE POLICY firmas_select_case ON firmas
  FOR SELECT
  USING ((EXISTS ( SELECT 1 FROM acuerdos a WHERE ((a.id = firmas.acuerdo_id) AND (is_part_of_case(a.caso_id) OR (SELECT is_admin()))))));

DROP POLICY IF EXISTS incumplimientos_insert_own ON incumplimientos;
CREATE POLICY incumplimientos_insert_own ON incumplimientos
  FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1 FROM acuerdos a WHERE ((a.id = incumplimientos.acuerdo_id) AND (is_part_of_case(a.caso_id) OR (SELECT is_admin()))))));

DROP POLICY IF EXISTS incumplimientos_select ON incumplimientos;
CREATE POLICY incumplimientos_select ON incumplimientos
  FOR SELECT
  USING ((EXISTS ( SELECT 1 FROM acuerdos a WHERE ((a.id = incumplimientos.acuerdo_id) AND (is_part_of_case(a.caso_id) OR (SELECT is_admin()))))));

DROP POLICY IF EXISTS incumplimientos_update_own ON incumplimientos;
CREATE POLICY incumplimientos_update_own ON incumplimientos
  FOR UPDATE
  USING ((EXISTS ( SELECT 1 FROM acuerdos a WHERE ((a.id = incumplimientos.acuerdo_id) AND (is_part_of_case(a.caso_id) OR (SELECT is_admin()))))));

DROP POLICY IF EXISTS invitaciones_select ON invitaciones;
CREATE POLICY invitaciones_select ON invitaciones
  FOR SELECT
  USING ((is_part_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS items_select_admin ON items;
CREATE POLICY items_select_admin ON items
  FOR SELECT
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS mediaciones_select ON mediaciones;
CREATE POLICY mediaciones_select ON mediaciones
  FOR SELECT
  USING ((is_part_of_case(caso_id) OR (mediador_id = (SELECT auth.uid())) OR (SELECT is_admin())));

DROP POLICY IF EXISTS mediaciones_update_mediator ON mediaciones;
CREATE POLICY mediaciones_update_mediator ON mediaciones
  FOR UPDATE
  USING (((mediador_id = (SELECT auth.uid())) OR (SELECT is_admin())));

DROP POLICY IF EXISTS notificaciones_insert_own ON notificaciones;
CREATE POLICY notificaciones_insert_own ON notificaciones
  FOR INSERT
  WITH CHECK (((usuario_id = (SELECT auth.uid())) OR (SELECT is_admin())));

DROP POLICY IF EXISTS notificaciones_select_admin ON notificaciones;
CREATE POLICY notificaciones_select_admin ON notificaciones
  FOR SELECT
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS notificaciones_update_own ON notificaciones;
CREATE POLICY notificaciones_update_own ON notificaciones
  FOR UPDATE
  USING (((usuario_id = (SELECT auth.uid())) OR (SELECT is_admin())));

DROP POLICY IF EXISTS pagos_select_own ON pagos;
CREATE POLICY pagos_select_own ON pagos
  FOR SELECT
  USING ((EXISTS ( SELECT 1 FROM suscripciones s WHERE ((s.id = pagos.suscripcion_id) AND ((s.usuario_id = (SELECT auth.uid())) OR (SELECT is_admin()))))));

DROP POLICY IF EXISTS propuestas_select ON propuestas;
CREATE POLICY propuestas_select ON propuestas
  FOR SELECT
  USING ((is_part_of_case(caso_id) OR is_mediator_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS respuestas_select ON respuestas_propuesta;
CREATE POLICY respuestas_select ON respuestas_propuesta
  FOR SELECT
  USING ((EXISTS ( SELECT 1 FROM propuestas p WHERE ((p.id = respuestas_propuesta.propuesta_id) AND (is_part_of_case(p.caso_id) OR (SELECT is_admin()))))));

DROP POLICY IF EXISTS rondas_select ON rondas;
CREATE POLICY rondas_select ON rondas
  FOR SELECT
  USING ((is_part_of_case(caso_id) OR is_mediator_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS suscripciones_select_own ON suscripciones;
CREATE POLICY suscripciones_select_own ON suscripciones
  FOR SELECT
  USING ((is_own_subscription(id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS tareas_insert_own ON tareas;
CREATE POLICY tareas_insert_own ON tareas
  FOR INSERT
  WITH CHECK ((is_part_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS tareas_select ON tareas;
CREATE POLICY tareas_select ON tareas
  FOR SELECT
  USING ((is_part_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS tareas_update_own ON tareas;
CREATE POLICY tareas_update_own ON tareas
  FOR UPDATE
  USING ((is_part_of_case(caso_id) OR (SELECT is_admin())));

DROP POLICY IF EXISTS usuarios_select_admin ON usuarios;
CREATE POLICY usuarios_select_admin ON usuarios
  FOR SELECT
  USING ((SELECT is_admin()));
