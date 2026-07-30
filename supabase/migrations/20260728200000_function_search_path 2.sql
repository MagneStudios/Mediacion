CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_ronda_actual()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.casos
  SET ronda_actual = NEW.numero
  WHERE id = NEW.caso_id
    AND NEW.numero > ronda_actual;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_caso_estado_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
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

CREATE OR REPLACE FUNCTION validate_propuesta_estado_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'pendiente' AND NEW.estado IN ('aceptada', 'rechazada') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
END;
$$;

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.is_part_of_case(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.caso_partes
    WHERE caso_id = case_uuid
      AND usuario_id = auth.uid()
      AND estado_invitacion = 'aceptada'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_mediator_of_case(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_estudio()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND rol = 'estudio'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner_estudio_of_case(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.is_own_subscription(sub_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.suscripciones
    WHERE id = sub_uuid
      AND usuario_id = auth.uid()
  );
$$;
