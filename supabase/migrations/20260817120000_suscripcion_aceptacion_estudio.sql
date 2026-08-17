-- ============================================================
-- Proyecto Mediación — Migration: anti-contratación para suscripciones de estudio
-- Fecha: 2026-08-17
-- Origen: _bmad-output/implementation-artifacts/spec-tyc-cierre-pendientes.md (CAP-3)
-- Fuentes: docs/reparto-tyc-devs.md (punto #11 y §07 checklist DB),
--          docs/decisiones-db/2026-08-14-tyc-contrato-con-db.md,
--          docs/pedidos-frontend-a-backend.md §3
-- Cierra el agujero que 20260814170000_tyc_legal.sql dejó anotado: el
--   trigger validate_suscripcion_aceptacion() solo valida la rama
--   NEW.usuario_id IS NOT NULL, así que un alta con estudio_id contrata
--   sin ninguna aceptación registrada. El XOR de suscripciones hace que
--   esa sea exactamente la mitad de los casos posibles.
-- Regla que se define acá (era "pendiente de BE/Producto"): el titular
--   del estudio es quien acepta. Tiene que existir un usuarios con ese
--   estudio_id, rol = 'estudio', activo, que aceptó los TyC vigentes.
--   Es el mismo criterio de titularidad que is_owner_estudio_of_case y
--   que AcuerdoAccessService: un 'parte' que apenas carga ese estudio_id
--   no alcanza para habilitar la contratación del estudio.
-- Reglas: aditiva sobre la lógica, sin DROP de objetos. Un solo
--   CREATE OR REPLACE de función; el trigger que la usa no se toca.
-- Rollback:
--   DROP TRIGGER IF EXISTS trigger_validate_suscripcion_aceptacion_titularidad
--     ON suscripciones;
--   y volver a la versión de 20260814170000_tyc_legal.sql —
--   CREATE OR REPLACE FUNCTION public.validate_suscripcion_aceptacion()
--   RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
--   BEGIN
--     IF NEW.usuario_id IS NOT NULL
--        AND NOT public.has_accepted_current(NEW.usuario_id, 'terms') THEN
--       RAISE EXCEPTION 'no_aceptacion_vigente: el usuario debe aceptar los Términos y Condiciones vigentes antes de contratar'
--         USING ERRCODE = '22000';
--     END IF;
--     RETURN NEW;
--   END;
--   $$;
-- ============================================================

-- ============================================================
-- 1. FUNCIÓN: validate_suscripcion_aceptacion()
--    La rama de usuario_id conserva su condición y su mensaje; lo único
--    que cambia en ella es el ERRCODE (ver abajo).
--    La rama nueva usa has_accepted_current sobre el titular del
--    estudio, no reimplementa la consulta de aceptación — misma regla
--    que aplica el resto del módulo legal.
--    El mensaje distingue las dos causas: "el estudio no tiene un
--    titular que haya aceptado" no se diagnostica igual que "este
--    usuario no aceptó", y quien lea el log de un 409 necesita saber
--    cuál de las dos fue.
--    ERRCODE pasa de 22000 a P0001 en LAS DOS ramas. La versión de
--    20260814170000 usaba 22000, que toDomainError
--    (apps/api/src/common/db/pg-error.ts) no mapea: solo conoce P0001 y
--    23505. Verificado contra una base real — el error crudo escapa y
--    AllExceptionsFilter lo devuelve como 500 internal_error. O sea que
--    hoy "contratar sin aceptar los TyC" se le informa al cliente como
--    una falla del servidor, cuando es una condición que el cliente
--    puede corregir y sobre la que el front necesita poder decir algo.
--    Con P0001 sale 409 conflict, que es lo que corresponde.
--    Esto cambia la respuesta de la rama de usuario_id, que ya existía:
--    de 500 a 409. Es un arreglo, no una regresión — pero es un cambio
--    de comportamiento sobre un camino vivo y queda dicho acá.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_suscripcion_aceptacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.usuario_id IS NOT NULL
     AND NOT public.has_accepted_current(NEW.usuario_id, 'terms') THEN
    RAISE EXCEPTION
      'no_aceptacion_vigente: el usuario debe aceptar los Términos y Condiciones vigentes antes de contratar'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.estudio_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.usuarios u
       WHERE u.estudio_id = NEW.estudio_id
         AND u.rol = 'estudio'
         AND u.activo = true
         AND public.has_accepted_current(u.id, 'terms')
     ) THEN
    RAISE EXCEPTION
      'no_aceptacion_vigente_estudio: el estudio necesita un titular activo que haya aceptado los Términos y Condiciones vigentes antes de contratar'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. TRIGGER: también en UPDATE de la titularidad
--    El trigger de 20260814170000 es BEFORE INSERT solamente, así que
--    reasignar una suscripción existente (UPDATE de usuario_id o de
--    estudio_id) esquivaba la regla por completo: se podía mover una
--    suscripción a un estudio sin titular que haya aceptado. Se agrega
--    un trigger de UPDATE acotado a esas dos columnas, para no revalidar
--    en cada cambio de estado o de fecha_fin — la baja escribe estado y
--    fecha_fin y no tiene por qué volver a pedir aceptación.
-- ============================================================

DROP TRIGGER IF EXISTS trigger_validate_suscripcion_aceptacion_titularidad
  ON suscripciones;

CREATE TRIGGER trigger_validate_suscripcion_aceptacion_titularidad
  BEFORE UPDATE OF usuario_id, estudio_id ON suscripciones
  FOR EACH ROW EXECUTE FUNCTION public.validate_suscripcion_aceptacion();

-- ============================================================
-- 3. Permisos
--    La función corre como trigger, invocada por el owner de la tabla.
--    Se revoca EXECUTE directo igual que el resto de las funciones del
--    módulo legal: nadie la llama a mano.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.validate_suscripcion_aceptacion()
  FROM PUBLIC, anon, authenticated;
