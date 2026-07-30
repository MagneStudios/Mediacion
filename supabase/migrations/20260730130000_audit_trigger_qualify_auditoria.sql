-- ============================================================
-- Proyecto Mediación — Migration: qualify auditoria inside audit_trigger_func
-- Fecha: 2026-07-30
--
-- Hallazgo: 20260728200000_function_search_path.sql agregó `SET search_path = ''`
-- a audit_trigger_func, pero su cuerpo referencia `auditoria` sin calificar en
-- las tres ramas (INSERT, UPDATE, DELETE). Con el search_path vacío, Postgres no
-- puede resolver el nombre y falla con:
--
--   error: relation "auditoria" does not exist
--     at .../casos/casos.repository.js:73
--
-- Nueve triggers usan esta función —audit_casos, audit_items, audit_propuestas,
-- audit_respuestas, audit_mediaciones, audit_acuerdos, audit_firmas,
-- audit_suscripciones, audit_pagos— así que TODA escritura sobre esas tablas
-- venía fallando en producción. Verificado contra el deploy: `POST /casos` con un
-- token válido devolvía 500, y ese es el error del log del contenedor.
--
-- Las demás funciones de esa migración ya calificaban sus referencias
-- (`sync_ronda_actual` usa `public.casos`); esta era la única rota. `auth.uid()`
-- ya venía calificado, por eso el fallo señalaba solo a `auditoria`.
--
-- No editamos la migración original porque ya se aplicó; esta la corrige hacia
-- adelante, y en un setup nuevo corre después, así que gana.
--
-- Por qué no lo detectó CI: la suite que ejercita la base está gateada y se
-- saltea, de modo que ningún test tocó un trigger real.
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.auditoria (usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.auditoria (usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.auditoria (usuario_id, accion, entidad, entidad_id, detalle)
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
-- Rollback: reaplicar la definición de 20260728200000_function_search_path.sql
-- (que vuelve a dejar la función rota, así que no es un rollback deseable).
