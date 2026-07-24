-- ============================================================
-- Proyecto Mediación — Migration 006: RLS Policies
-- Fecha: 2026-07-20
-- RN/CA: RN-01 (aislamiento items), RN-09 (solo webhook firma),
--        CA-02 (parte no ve posiciones de otra), RNF-01/02
-- Mecanismo auth: Supabase Auth → auth.uid()
-- Rollback: ALTER TABLE <tabla> DISABLE ROW LEVEL SECURITY;
--           DROP POLICY <policy> ON <tabla>;
-- ============================================================

-- ============================================================
-- HABILITAR RLS en todas las tablas sensibles
-- ============================================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudios ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caso_partes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rondas ENABLE ROW LEVEL SECURITY;
ALTER TABLE propuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_propuesta ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE acuerdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE firmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE incumplimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inversores ENABLE ROW LEVEL SECURITY;

-- planes e inversores: RLS habilitado con policies permisivas (lectura pública)

-- ============================================================
-- USUARIOS
-- ============================================================

-- SELECT: propio perfil + admin ve todos
CREATE POLICY usuarios_select_own ON usuarios
  FOR SELECT USING (id = auth.uid());

CREATE POLICY usuarios_select_admin ON usuarios
  FOR SELECT USING (is_admin());

-- UPDATE: propio perfil
CREATE POLICY usuarios_update_own ON usuarios
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- ESTUDIOS
-- ============================================================

-- SELECT: el estudio ve su propio registro + admin ve todos
CREATE POLICY estudios_select_own ON estudios
  FOR SELECT USING (
    id = (SELECT estudio_id FROM usuarios WHERE id = auth.uid())
    OR is_admin()
  );

-- ============================================================
-- CARPETAS
-- ============================================================

-- SELECT: carpetas del estudio propio + admin
CREATE POLICY carpetas_select_own ON carpetas
  FOR SELECT USING (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = auth.uid())
    OR is_admin()
  );

-- INSERT/UPDATE: estudio propio + admin
CREATE POLICY carpetas_insert_own ON carpetas
  FOR INSERT WITH CHECK (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = auth.uid())
    OR is_admin()
  );

CREATE POLICY carpetas_update_own ON carpetas
  FOR UPDATE USING (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = auth.uid())
    OR is_admin()
  );

CREATE POLICY carpetas_delete_own ON carpetas
  FOR DELETE USING (
    estudio_id = (SELECT estudio_id FROM usuarios WHERE id = auth.uid())
    OR is_admin()
  );

-- ============================================================
-- CASOS (§5 máquina de estados)
-- ============================================================

-- SELECT: partes del caso + estudio dueño + admin
CREATE POLICY casos_select_part ON casos
  FOR SELECT USING (
    is_part_of_case(id)
    OR is_owner_estudio_of_case(id)
    OR is_admin()
  );

-- INSERT: parte o estudio crea caso propio
CREATE POLICY casos_insert_own ON casos
  FOR INSERT WITH CHECK (creador_id = auth.uid());

-- UPDATE: partes del caso (para terminación autónoma, plazo, etc.)
CREATE POLICY casos_update_part ON casos
  FOR UPDATE USING (
    is_part_of_case(id)
    OR is_owner_estudio_of_case(id)
  );

-- ============================================================
-- CASO_PARTES
-- ============================================================

-- SELECT: partes del mismo caso + admin
CREATE POLICY caso_partes_select ON caso_partes
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR is_admin()
  );

-- ============================================================
-- INVITACIONES
-- ============================================================

-- SELECT: partes del caso + admin
CREATE POLICY invitaciones_select ON invitaciones
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR is_admin()
  );

-- ============================================================
-- ITEMS — CRÍTICO: RN-01 / CA-02 (aislamiento de posiciones)
-- ============================================================

-- SELECT: dueño del ítem O mediador del caso O admin
-- NUNCA la contraparte — esto es la defensa en profundidad.
CREATE POLICY items_select_own ON items
  FOR SELECT USING (parte_id = auth.uid());

CREATE POLICY items_select_mediator ON items
  FOR SELECT USING (is_mediator_of_case(caso_id));

CREATE POLICY items_select_admin ON items
  FOR SELECT USING (is_admin());

-- INSERT: solo el dueño, solo en sus casos
CREATE POLICY items_insert_own ON items
  FOR INSERT WITH CHECK (
    parte_id = auth.uid()
    AND is_part_of_case(caso_id)
  );

-- UPDATE: solo el dueño
CREATE POLICY items_update_own ON items
  FOR UPDATE USING (parte_id = auth.uid());

-- DELETE: solo el dueño
CREATE POLICY items_delete_own ON items
  FOR DELETE USING (parte_id = auth.uid());

-- ============================================================
-- RONDAS
-- ============================================================

-- SELECT: partes del caso + mediador + admin
CREATE POLICY rondas_select ON rondas
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR is_mediator_of_case(caso_id)
    OR is_admin()
  );

-- ============================================================
-- PROPUESTAS
-- ============================================================

-- SELECT: partes del caso + mediador + admin
CREATE POLICY propuestas_select ON propuestas
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR is_mediator_of_case(caso_id)
    OR is_admin()
  );

-- INSERT: backend (service role) genera propuestas; parte puede trigger
CREATE POLICY propuestas_insert ON propuestas
  FOR INSERT WITH CHECK (
    is_part_of_case(caso_id)
  );

-- ============================================================
-- RESPUESTAS_PROPUESTA
-- ============================================================

-- SELECT: partes del caso que contiene la propuesta + admin
CREATE POLICY respuestas_select ON respuestas_propuesta
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM propuestas p
      WHERE p.id = propuesta_id
        AND (is_part_of_case(p.caso_id) OR is_admin())
    )
  );

-- INSERT: solo el dueño responde
CREATE POLICY respuestas_insert ON respuestas_propuesta
  FOR INSERT WITH CHECK (parte_id = auth.uid());

-- ============================================================
-- MEDIACIONES (RN-05)
-- ============================================================

-- SELECT: partes del caso + mediador asignado + admin
CREATE POLICY mediaciones_select ON mediaciones
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR mediador_id = auth.uid()
    OR is_admin()
  );

-- ============================================================
-- ACUERDOS (RN-09)
-- ============================================================

-- SELECT: partes del caso + admin
CREATE POLICY acuerdos_select ON acuerdos
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR is_admin()
  );

-- ============================================================
-- FIRMAS (RN-09)
-- ============================================================

-- SELECT: propio + partes del caso + admin
CREATE POLICY firmas_select_own ON firmas
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY firmas_select_case ON firmas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM acuerdos a
      WHERE a.id = acuerdo_id
        AND (is_part_of_case(a.caso_id) OR is_admin())
    )
  );

-- ============================================================
-- TAREAS (RN-14)
-- ============================================================

-- SELECT: partes del caso + admin
CREATE POLICY tareas_select ON tareas
  FOR SELECT USING (
    is_part_of_case(caso_id)
    OR is_admin()
  );

-- ============================================================
-- INCUMPLIMIENTOS
-- ============================================================

-- SELECT: partes del caso del acuerdo + admin
CREATE POLICY incumplimientos_select ON incumplimientos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM acuerdos a
      WHERE a.id = acuerdo_id
        AND (is_part_of_case(a.caso_id) OR is_admin())
    )
  );

-- ============================================================
-- NOTIFICACIONES (RN-11)
-- ============================================================

-- SELECT: propio + admin
CREATE POLICY notificaciones_select_own ON notificaciones
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY notificaciones_select_admin ON notificaciones
  FOR SELECT USING (is_admin());

-- ============================================================
-- SUSCRIPCIONES
-- ============================================================

-- SELECT: propio + admin
CREATE POLICY suscripciones_select_own ON suscripciones
  FOR SELECT USING (
    is_own_subscription(id) OR is_admin()
  );

-- ============================================================
-- PAGOS
-- ============================================================

-- SELECT: propio (vía suscripción) + admin
CREATE POLICY pagos_select_own ON pagos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM suscripciones s
      WHERE s.id = suscripcion_id
        AND (s.usuario_id = auth.uid() OR is_admin())
    )
  );

-- ============================================================
-- CONFIGURACIÓN
-- ============================================================

-- Solo admin puede leer/escriber configuración
CREATE POLICY configuracion_select_admin ON configuracion
  FOR SELECT USING (is_admin());

CREATE POLICY configuracion_insert_admin ON configuracion
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY configuracion_update_admin ON configuracion
  FOR UPDATE USING (is_admin());

CREATE POLICY configuracion_delete_admin ON configuracion
  FOR DELETE USING (is_admin());

-- ============================================================
-- AUDITORÍA (RNF-10)
-- ============================================================

-- Solo admin puede leer auditoría
CREATE POLICY auditoria_select_admin ON auditoria
  FOR SELECT USING (is_admin());

-- Escritura solo por triggers (service role bypasses RLS)
-- No se necesitan INSERT/UPDATE/DELETE policies

-- ============================================================
-- PLANES — catálogo público (lectura para todos)
-- ============================================================

CREATE POLICY planes_select_all ON planes
  FOR SELECT USING (true);

-- ============================================================
-- INVERSORES — formulario público (lectura + inserción)
-- ============================================================

CREATE POLICY inversores_select_all ON inversores
  FOR SELECT USING (true);

CREATE POLICY inversores_insert_anon ON inversores
  FOR INSERT WITH CHECK (true);