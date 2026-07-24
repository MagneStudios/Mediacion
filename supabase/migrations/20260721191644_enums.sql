-- ============================================================
-- Proyecto Mediación — Migration 002: Enums
-- Fecha: 2026-07-20
-- RN/CA: Glosario §4, Diccionario §5, Máquinas de estado §5
-- Rollback: DROP TYPE <enum_name> CASCADE; (uno por uno)
-- ============================================================

-- Identidad
CREATE TYPE rol_usuario AS ENUM (
  'admin', 'parte', 'mediador', 'estudio'
);

CREATE TYPE verif_biometrica AS ENUM (
  'pendiente', 'aprobada', 'rechazada'
);

-- Casos
CREATE TYPE metodo_caso AS ENUM (
  'negociacion', 'conciliacion', 'mediacion'
);

CREATE TYPE estado_caso AS ENUM (
  'nuevo', 'activo', 'en_negociacion', 'acordado', 'cerrado', 'terminado', 'vencido'
);

CREATE TYPE rol_en_caso AS ENUM (
  'parte_a', 'parte_b', 'mediador'
);

CREATE TYPE estado_invitacion AS ENUM (
  'pendiente', 'aceptada', 'rechazada', 'expirada'
);

CREATE TYPE tipo_invitacion AS ENUM (
  'link', 'codigo', 'email'
);

-- Items
CREATE TYPE categoria_item AS ENUM (
  'cuidado_ninos', 'cronogramas', 'bienes', 'economico', 'personalizado'
);

-- Rondas y propuestas
CREATE TYPE estado_ronda AS ENUM (
  'activa', 'completada'
);

CREATE TYPE estado_propuesta AS ENUM (
  'pendiente', 'aceptada', 'rechazada'
);

CREATE TYPE decision_propuesta AS ENUM (
  'acepta', 'rechaza'
);

-- Mediación
CREATE TYPE estado_mediacion AS ENUM (
  'solicitada', 'aceptada', 'rechazada', 'activa', 'finalizada'
);

-- Acuerdos y post-acuerdo
CREATE TYPE estado_acuerdo AS ENUM (
  'borrador', 'enviado_a_firma', 'firmado', 'con_aviso'
);

CREATE TYPE tipo_tarea AS ENUM (
  'tarea', 'evento_calendario'
);

CREATE TYPE estado_tarea AS ENUM (
  'pendiente', 'en_progreso', 'completada'
);

-- Monetización
CREATE TYPE estado_suscripcion AS ENUM (
  'activa', 'cancelada', 'vencida', 'pendiente_pago'
);

CREATE TYPE estado_pago AS ENUM (
  'pendiente', 'aprobado', 'rechazado'
);

-- Notificaciones
CREATE TYPE canal_notificacion AS ENUM (
  'email', 'push'
);