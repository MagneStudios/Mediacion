-- ============================================================
-- Proyecto Mediación — Migration 003: Tables
-- Fecha: 2026-07-20
-- RN/CA: Modelo de datos §5, Diccionario §5
-- Rollback: DROP TABLE en orden inverso; DROP TYPE CASCADE;
-- ============================================================

-- ============================================================
-- MÓDULO: CATÁLOGO / CONFIGURACIÓN (sin FKs)
-- ============================================================

CREATE TABLE planes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  limite_carpetas INT NOT NULL,
  limite_casos INT NOT NULL,
  limite_iteraciones_ia INT NOT NULL,
  precio NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE configuracion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor JSONB NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inversores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  capital_disponible TEXT,
  experiencia TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: IDENTIDAD
-- ============================================================

CREATE TABLE estudios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  plan_id UUID REFERENCES planes(id),
  marca_config JSONB,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- usuarios.id referencia auth.users(id) de Supabase Auth.
-- El registro se crea vía trigger on_auth_user_created (ver functions_triggers).
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol rol_usuario NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  documento TEXT UNIQUE,
  telefono TEXT,
  idioma TEXT DEFAULT 'es',
  verif_biometrica verif_biometrica DEFAULT 'pendiente',
  estudio_id UUID REFERENCES estudios(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE carpetas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estudio_id UUID NOT NULL REFERENCES estudios(id),
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: MONETIZACIÓN
-- ============================================================

CREATE TABLE suscripciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  estudio_id UUID REFERENCES estudios(id),
  plan_id UUID NOT NULL REFERENCES planes(id),
  estado estado_suscripcion NOT NULL DEFAULT 'pendiente_pago',
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  suscripcion_id UUID NOT NULL REFERENCES suscripciones(id),
  mp_payment_id TEXT UNIQUE,
  estado estado_pago NOT NULL DEFAULT 'pendiente',
  monto NUMERIC(10,2) NOT NULL,
  metodo TEXT,
  fecha TIMESTAMPTZ,
  raw_webhook JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: CASOS Y VINCULACIÓN
-- ============================================================

CREATE TABLE casos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creador_id UUID NOT NULL REFERENCES usuarios(id),
  estudio_id UUID REFERENCES estudios(id),
  carpeta_id UUID REFERENCES carpetas(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  metodo metodo_caso NOT NULL,
  estado estado_caso NOT NULL DEFAULT 'nuevo',
  ronda_actual INT NOT NULL DEFAULT 1,
  sla_tipo TEXT,
  plazo TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE caso_partes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  rol_en_caso rol_en_caso NOT NULL,
  estado_invitacion estado_invitacion NOT NULL DEFAULT 'pendiente',
  fecha_union TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invitaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  tipo tipo_invitacion NOT NULL,
  token TEXT UNIQUE,
  email_destino TEXT,
  estado estado_invitacion NOT NULL DEFAULT 'pendiente',
  fecha_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: ITEMS / POSICIONES (RN-01, RN-02)
-- ============================================================

CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  categoria categoria_item NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  valor_min TEXT,
  valor_max TEXT,
  puede_ceder BOOLEAN NOT NULL DEFAULT false,
  condiciones_cesion TEXT,
  privado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: RONDAS Y PROPUESTAS (RN-03, RN-04)
-- ============================================================

CREATE TABLE rondas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  numero INT NOT NULL,
  estado estado_ronda NOT NULL DEFAULT 'activa',
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE propuestas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  ronda_id UUID NOT NULL REFERENCES rondas(id),
  contenido JSONB NOT NULL,
  fundamentacion TEXT,
  estado estado_propuesta NOT NULL DEFAULT 'pendiente',
  modelo_ia TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE respuestas_propuesta (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  propuesta_id UUID NOT NULL REFERENCES propuestas(id),
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  decision decision_propuesta NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: MEDIACIÓN (RN-05)
-- ============================================================

CREATE TABLE mediaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  mediador_id UUID NOT NULL REFERENCES usuarios(id),
  estado estado_mediacion NOT NULL DEFAULT 'solicitada',
  ronda INT NOT NULL,
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_aceptacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: ACUERDOS Y POST-ACUERDO (RN-09, RN-14)
-- ============================================================

CREATE TABLE acuerdos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id),
  contenido JSONB NOT NULL,
  documento_url TEXT,
  docusign_envelope_id TEXT,
  estado estado_acuerdo NOT NULL DEFAULT 'borrador',
  fecha TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE firmas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  acuerdo_id UUID NOT NULL REFERENCES acuerdos(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  docusign_status TEXT NOT NULL DEFAULT 'pending',
  fecha_firma TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tareas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  acuerdo_id UUID NOT NULL REFERENCES acuerdos(id),
  caso_id UUID NOT NULL REFERENCES casos(id),
  tipo tipo_tarea NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_evento TIMESTAMPTZ,
  estado estado_tarea NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incumplimientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  acuerdo_id UUID NOT NULL REFERENCES acuerdos(id),
  reportante_id UUID NOT NULL REFERENCES usuarios(id),
  descripcion TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: NOTIFICACIONES (RN-11)
-- ============================================================

CREATE TABLE notificaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  caso_id UUID REFERENCES casos(id),
  canal canal_notificacion NOT NULL,
  evento TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  fecha TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO: AUDITORÍA (RNF-10)
-- ============================================================

CREATE TABLE auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id UUID,
  detalle JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GRANTS: permisos base para roles de Supabase Auth
-- RLS filtra filas; estos grants dan acceso a nivel tabla.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;