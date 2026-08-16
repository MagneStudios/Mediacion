-- ============================================================
-- Proyecto Mediación — Migration: avisos de versión legal y canal de contacto
-- Fecha: 2026-08-15
-- Origen: _bmad-output/specs/spec-tyc-legal-backend/migraciones-nuevas.md
-- Fuentes: docs/reparto-tyc-devs.md (§03 BE, puntos #15 y #23),
--          docs/Instructivo_Implementacion_TyC_-_Golosetti_Abogados.md (§4 y §5)
-- Cierra lo que le falta al esquema para las dos capacidades de BE que
--   todavía no tenían dónde escribir: la traza idempotente del aviso de
--   cambio de versión (avisos_version_legal) y el registro con fecha de
--   ingreso del canal de contacto (solicitudes_contacto).
-- Reglas: aditiva, sin DROP/ALTER sobre objetos existentes. Las tres
--   tablas legales de 20260814170000_tyc_legal.sql quedan intactas.
--   GRANTs explícitos por objeto, sin ALTER DEFAULT PRIVILEGES.
-- Rollback:
--   DROP TRIGGER IF EXISTS audit_solicitudes_contacto ON solicitudes_contacto;
--   DROP TRIGGER IF EXISTS set_updated_at ON solicitudes_contacto;
--   DROP TRIGGER IF EXISTS trigger_assign_contacto_codigo ON solicitudes_contacto;
--   DROP FUNCTION public.assign_contacto_codigo();
--   DROP SEQUENCE public.solicitudes_contacto_codigo_seq;
--   DROP TABLE public.solicitudes_contacto, public.avisos_version_legal;
-- ============================================================

-- ============================================================
-- 1. TABLA: avisos_version_legal
--    Traza del preaviso de cambio de versión. El índice único es la
--    idempotencia del barrido: un existence check dentro de la
--    transacción no alcanza porque bajo READ COMMITTED dos corridas
--    concurrentes ven ambas "no hay nada" y ambas insertan.
--    ON DELETE RESTRICT por la misma razón que user_agreements: es
--    prueba del cumplimiento de un plazo legal, no puede desaparecer
--    con el usuario.
--    enviado_at separa "reclamado" de "entregado": el barrido inserta
--    la fila primero (el índice único resuelve la carrera), manda el
--    mail y recién ahí la marca. Una corrida que muere en el medio deja
--    la fila con enviado_at NULL y la siguiente la reintenta, en vez de
--    perder el aviso en silencio.
-- ============================================================

CREATE TABLE avisos_version_legal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('terms', 'privacy')),
  version TEXT NOT NULL,
  notificado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX avisos_version_legal_unico
  ON avisos_version_legal (usuario_id, tipo, version);

-- "¿qué publicaciones ya se notificaron?" (barrido por tipo/versión)
CREATE INDEX avisos_version_legal_documento_idx
  ON avisos_version_legal (tipo, version);

-- Reintento del barrido: filas reclamadas cuyo email nunca salió
CREATE INDEX avisos_version_legal_pendientes_idx
  ON avisos_version_legal (tipo, version) WHERE enviado_at IS NULL;

-- ============================================================
-- 2. TABLA: solicitudes_contacto
--    Espeja solicitudes_arrepentimiento: endpoint público, escritura
--    por rol de servidor, codigo CON-0001… por trigger con secuencia
--    propia, usuario_id con SET NULL. received_at es la fecha de
--    ingreso que sostiene el plazo de respuesta declarado.
--    Reutiliza el enum estado_arrepentimiento: son los mismos estados
--    operativos y un enum paralelo no agregaría nada.
-- ============================================================

CREATE SEQUENCE solicitudes_contacto_codigo_seq;

CREATE TABLE solicitudes_contacto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado estado_arrepentimiento NOT NULL DEFAULT 'recibida',
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX solicitudes_contacto_email_idx
  ON solicitudes_contacto (email);

CREATE INDEX solicitudes_contacto_received_at_idx
  ON solicitudes_contacto (received_at);

-- ============================================================
-- 3. TRIGGER: generador de codigo en solicitudes_contacto
--    Patrón casos.codigo / solicitudes_arrepentimiento.codigo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_contacto_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.codigo IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.codigo := 'CON-'
    || lpad(nextval('public.solicitudes_contacto_codigo_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_contacto_codigo
  BEFORE INSERT ON solicitudes_contacto
  FOR EACH ROW EXECUTE FUNCTION public.assign_contacto_codigo();

-- ============================================================
-- 4. TRIGGERS: updated_at y auditoría (patrón del repo)
--    avisos_version_legal no tiene updated_at: su única mutación es
--    marcar enviado_at una vez, no hay edición de contenido.
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON solicitudes_contacto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_solicitudes_contacto AFTER INSERT OR UPDATE OR DELETE ON solicitudes_contacto
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================================
-- 5. RLS: sin policies para anon/authenticated
--    Las dos tablas son de rol de servidor. RLS habilitada y sin
--    policies = nadie más entra, ni siquiera a leer.
-- ============================================================

ALTER TABLE avisos_version_legal ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_contacto ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. GRANTs explícitos
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON TABLE public.avisos_version_legal
  TO service_role, postgres;

GRANT SELECT, INSERT, UPDATE ON TABLE public.solicitudes_contacto
  TO service_role, postgres;
GRANT USAGE ON SEQUENCE public.solicitudes_contacto_codigo_seq
  TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.assign_contacto_codigo()
  FROM PUBLIC, anon, authenticated;
