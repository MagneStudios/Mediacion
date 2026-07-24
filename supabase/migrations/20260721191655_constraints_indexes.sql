-- ============================================================
-- Proyecto Mediación — Migration 004: Constraints & Indexes
-- Fecha: 2026-07-20
-- RN/CA: RN-01 (índice items), RN-07 (unique caso_partes),
--        CHECK XOR suscripciones
-- Rollback: Ver comentarios por constraint
-- ============================================================

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

-- RN-07: un usuario no puede estar dos veces en el mismo caso
ALTER TABLE caso_partes
  ADD CONSTRAINT caso_partes_caso_usuario_unique UNIQUE (caso_id, usuario_id);
-- Rollback: ALTER TABLE caso_partes DROP CONSTRAINT caso_partes_caso_usuario_unique;

-- Un caso no puede tener dos rondas con el mismo número
ALTER TABLE rondas
  ADD CONSTRAINT rondas_caso_numero_unique UNIQUE (caso_id, numero);
-- Rollback: ALTER TABLE rondas DROP CONSTRAINT rondas_caso_numero_unique;

-- Una parte solo responde una vez por propuesta
ALTER TABLE respuestas_propuesta
  ADD CONSTRAINT respuestas_propuesta_unique UNIQUE (propuesta_id, parte_id);
-- Rollback: ALTER TABLE respuestas_propuesta DROP CONSTRAINT respuestas_propuesta_unique;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

-- Suscripciones: exactamente uno de usuario_id / estudio_id debe ser NOT NULL
ALTER TABLE suscripciones
  ADD CONSTRAINT suscripciones_xor_usuario_estudio
  CHECK (
    (usuario_id IS NOT NULL AND estudio_id IS NULL) OR
    (usuario_id IS NULL AND estudio_id IS NOT NULL)
  );
-- Rollback: ALTER TABLE suscripciones DROP CONSTRAINT suscripciones_xor_usuario_estudio;

-- ============================================================
-- INDEXES — Queries de la §6 (Contrato de API)
-- ============================================================

-- RN-01: Query crítica — items por caso Y parte (aislamiento de posiciones)
CREATE INDEX idx_items_caso_parte ON items (caso_id, parte_id);

-- Casos propios del usuario
CREATE INDEX idx_casos_creador ON casos (creador_id);

-- Casos de un estudio
CREATE INDEX idx_casos_estudio ON casos (estudio_id) WHERE estudio_id IS NOT NULL;

-- Casos de un estudio en una carpeta
CREATE INDEX idx_casos_estudio_carpeta ON casos (estudio_id, carpeta_id)
  WHERE estudio_id IS NOT NULL AND carpeta_id IS NOT NULL;

-- Propuestas por caso y ronda
CREATE INDEX idx_propuestas_caso_ronda ON propuestas (caso_id, ronda_id);

-- Respuestas por propuesta
CREATE INDEX idx_respuestas_propuesta ON respuestas_propuesta (propuesta_id);

-- Mediaciones por caso
CREATE INDEX idx_mediaciones_caso ON mediaciones (caso_id);

-- Acuerdos por caso
CREATE INDEX idx_acuerdos_caso ON acuerdos (caso_id);

-- Notificaciones pendientes por usuario
CREATE INDEX idx_notificaciones_usuario_estado ON notificaciones (usuario_id, estado);

-- Auditoría por entidad + id (lookup de historial)
CREATE INDEX idx_auditoria_entidad ON auditoria (entidad, entidad_id);

-- Auditoría por usuario + fecha (trail por usuario)
CREATE INDEX idx_auditoria_usuario_fecha ON auditoria (usuario_id, created_at);

-- Suscripciones activas por usuario
CREATE INDEX idx_suscripciones_usuario ON suscripciones (usuario_id)
  WHERE usuario_id IS NOT NULL;

-- Suscripciones activas por estudio
CREATE INDEX idx_suscripciones_estudio ON suscripciones (estudio_id)
  WHERE estudio_id IS NOT NULL;

-- Invitaciones por token (lookup por link/código)
CREATE INDEX idx_invitaciones_token ON invitaciones (token) WHERE token IS NOT NULL;

-- Tareas por acuerdo
CREATE INDEX idx_tareas_acuerdo ON tareas (acuerdo_id);

-- Firmas por acuerdo
CREATE INDEX idx_firmas_acuerdo ON firmas (acuerdo_id);