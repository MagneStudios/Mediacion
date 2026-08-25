-- =============================================================================
-- 011 · custom_access_token hook function
-- Inyecta claims de usuario (rol, estudio_id, nombre_completo) al JWT
-- antes de que GoTrue emita el token.
--
-- Event payload (Supabase custom_access_token hook):
--   { "user_id": "uuid", "claims": { sub, role, exp, ... }, "authentication_method": "..." }
--
-- Patrón oficial: copiar los claims existentes y agregar los custom,
-- NO reemplazarlos. Los claims requeridos por GoTrue (sub, role, aud,
-- exp, iat, aal, email, phone, etc.) deben preservarse siempre.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id    uuid;
  _rol        text;
  _estudio_id uuid;
  _nombre     text;
  _apellido   text;
  _claims     jsonb;
BEGIN
  _user_id := (event ->> 'user_id')::uuid;

  SELECT u.rol, u.estudio_id, u.nombre, u.apellido
    INTO _rol, _estudio_id, _nombre, _apellido
  FROM public.usuarios u
  WHERE u.id = _user_id;

  _claims := event -> 'claims';

  _claims := jsonb_set(_claims, '{rol}',            to_jsonb(COALESCE(_rol, 'parte')));
  _claims := jsonb_set(_claims, '{estudio_id}',     COALESCE(to_jsonb(_estudio_id), 'null'::jsonb));
  _claims := jsonb_set(_claims, '{nombre_completo}', to_jsonb(COALESCE(_nombre || ' ' || _apellido, '')));

  RETURN jsonb_build_object('claims', _claims);

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    _claims := event -> 'claims';
    _claims := jsonb_set(_claims, '{rol}', '"parte"');
    RETURN jsonb_build_object('claims', _claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token(jsonb) TO supabase_auth_admin;
