-- ============================================================
-- Proyecto Mediación — Migration 005: Functions & Triggers
-- Fecha: 2026-07-20
-- RN/CA: updated_at (convención), RN-04 (sync ronda_actual),
--        Máquina de estados §5, RNF-10 (auditoría),
--        Supabase Auth (handle_new_user)
-- Rollback: Ver comentarios por función/trigger
-- ============================================================

-- ============================================================
-- 1. TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Rollback: DROP FUNCTION update_updated_at_column();

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON estudios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON carpetas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON planes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON configuracion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON suscripciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON casos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON caso_partes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON invitaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON rondas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON propuestas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON mediaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON acuerdos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tareas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. SUPABASE AUTH: crear usuario en public.usuarios al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, rol, nombre, apellido)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'rol')::text, 'parte')::rol_usuario,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellido', '')
  );
  RETURN NEW;
END;
$$;
-- Rollback: DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Rollback: DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================================
-- 3. SYNC: casos.ronda_actual se sincroniza con tabla rondas (RN-04)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_ronda_actual()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE casos
  SET ronda_actual = NEW.numero
  WHERE id = NEW.caso_id
    AND NEW.numero > ronda_actual;
  RETURN NEW;
END;
$$;
-- Rollback: DROP FUNCTION sync_ronda_actual();

CREATE TRIGGER trigger_sync_ronda_actual
  AFTER INSERT ON rondas
  FOR EACH ROW EXECUTE FUNCTION sync_ronda_actual();
-- Rollback: DROP TRIGGER IF EXISTS trigger_sync_ronda_actual ON rondas;

-- ============================================================
-- 4. VALIDACIÓN: máquina de estados del caso (§5)
--    Transiciones válidas:
--      nuevo       → activo, terminado
--      activo      → en_negociacion, terminado, vencido
--      en_negociacion → acordado, terminado, vencido
--      acordado    → cerrado
--      cerrado/terminado/vencido → (terminal, sin cambios)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_caso_estado_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'nuevo' AND NEW.estado IN ('activo', 'terminado') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'activo' AND NEW.estado IN ('en_negociacion', 'terminado', 'vencido') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'en_negociacion' AND NEW.estado IN ('acordado', 'terminado', 'vencido') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'acordado' AND NEW.estado = 'cerrado' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
END;
$$;
-- Rollback: DROP FUNCTION validate_caso_estado_transition();

CREATE TRIGGER trigger_validate_caso_estado
  BEFORE UPDATE OF estado ON casos
  FOR EACH ROW EXECUTE FUNCTION validate_caso_estado_transition();
-- Rollback: DROP TRIGGER IF EXISTS trigger_validate_caso_estado ON casos;

-- ============================================================
-- 5. AUDITORÍA: log de acciones relevantes (RNF-10)
--    Se aplica a las tablas sensibles: casos, items, propuestas,
--    respuestas_propuesta, mediaciones, acuerdos, firmas,
--    suscripciones, pagos.
--    Para webhooks (sin JWT), auth.uid() devuelve NULL → se registra.
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
END;
$$;
-- Rollback: DROP FUNCTION audit_trigger_func();

-- Aplicar audit a tablas sensibles
CREATE TRIGGER audit_casos AFTER INSERT OR UPDATE OR DELETE ON casos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_items AFTER INSERT OR UPDATE OR DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_propuestas AFTER INSERT OR UPDATE OR DELETE ON propuestas
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_respuestas AFTER INSERT OR UPDATE OR DELETE ON respuestas_propuesta
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_mediaciones AFTER INSERT OR UPDATE OR DELETE ON mediaciones
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_acuerdos AFTER INSERT OR UPDATE OR DELETE ON acuerdos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_firmas AFTER INSERT OR UPDATE OR DELETE ON firmas
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_suscripciones AFTER INSERT OR UPDATE OR DELETE ON suscripciones
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_pagos AFTER INSERT OR UPDATE OR DELETE ON pagos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- 6. FUNCIONES HELPER para RLS (usadas en las policies)
-- ============================================================

-- ¿El usuario actual es parte de un caso?
CREATE OR REPLACE FUNCTION public.is_part_of_case(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.caso_partes
    WHERE caso_id = case_uuid
      AND usuario_id = auth.uid()
      AND estado_invitacion = 'aceptada'
  );
$$;

-- ¿El usuario actual es mediador de un caso?
CREATE OR REPLACE FUNCTION public.is_mediator_of_case(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.caso_partes
    WHERE caso_id = case_uuid
      AND usuario_id = auth.uid()
      AND rol_en_caso = 'mediador'
      AND estado_invitacion = 'aceptada'
  );
$$;

-- ¿El usuario actual es admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND rol = 'admin'
  );
$$;

-- ¿El usuario actual es de rol estudio?
CREATE OR REPLACE FUNCTION public.is_estudio()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND rol = 'estudio'
  );
$$;

-- ¿El usuario actual es dueño del estudio del caso?
CREATE OR REPLACE FUNCTION public.is_owner_estudio_of_case(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.casos c
    JOIN public.usuarios u ON u.id = auth.uid()
    WHERE c.id = case_uuid
      AND c.estudio_id = u.estudio_id
      AND u.rol = 'estudio'
  );
$$;

-- ¿El usuario actual es propietario de la suscripción?
CREATE OR REPLACE FUNCTION public.is_own_subscription(sub_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.suscripciones
    WHERE id = sub_uuid
      AND usuario_id = auth.uid()
  );
$$;