-- ============================================================
-- Proyecto Mediación — Migration: módulo legal (TyC)
-- Fecha: 2026-08-14
-- Origen: docs/prompts-db/implementar-tyc-legal.md
-- Fuentes: docs/tyc-contrato-frontend.md (§2 shapes congelados),
--          docs/decisiones-db/2026-08-14-tyc-contrato-con-db.md (decisiones 1-7),
--          docs/reparto-tyc-devs.md (§02 DB)
-- Cierra el gap de "prueba de aceptación legal": legal_documents,
--   user_agreements (append-only real) y solicitudes_arrepentimiento,
--   más la garantía "no contratar sin aceptación vigente" (trigger en
--   suscripciones vía has_accepted_current).
-- Reglas: aditiva, sin DROP/ALTER sobre objetos existentes. Las 47
--   policies actuales quedan intactas. GRANTs explícitos por objeto,
--   sin ALTER DEFAULT PRIVILEGES (filosofía del repo).
-- Rollback:
--   DROP TRIGGER IF EXISTS audit_arrepentimientos ON solicitudes_arrepentimiento;
--   DROP TRIGGER IF EXISTS audit_legal_documents ON legal_documents;
--   DROP TRIGGER IF EXISTS set_updated_at ON solicitudes_arrepentimiento;
--   DROP TRIGGER IF EXISTS set_updated_at ON legal_documents;
--   DROP TRIGGER IF EXISTS trigger_assign_arrepentimiento_codigo ON solicitudes_arrepentimiento;
--   DROP TRIGGER IF EXISTS user_agreements_no_delete ON user_agreements;
--   DROP TRIGGER IF EXISTS user_agreements_no_update ON user_agreements;
--   DROP TRIGGER IF EXISTS trigger_validate_suscripcion_aceptacion ON suscripciones;
--   DROP FUNCTION public.assign_arrepentimiento_codigo();
--   DROP FUNCTION public.prevent_user_agreements_modification();
--   DROP FUNCTION public.validate_suscripcion_aceptacion();
--   DROP FUNCTION public.has_accepted_current(uuid, text);
--   DROP SEQUENCE public.solicitudes_arrepentimiento_codigo_seq;
--   DROP TABLE public.solicitudes_arrepentimiento, public.user_agreements, public.legal_documents;
--   DROP TYPE public.estado_arrepentimiento;
-- ============================================================

-- ============================================================
-- 1. ENUM: estado_arrepentimiento
-- ============================================================

CREATE TYPE estado_arrepentimiento AS ENUM (
  'recibida',
  'en_proceso',
  'resuelta',
  'rechazada'
);

-- ============================================================
-- 2. TABLA: legal_documents
--    Texto completo en la base, no en el front. Una sola versión
--    vigente por tipo (partial unique). Lectura pública de la vigente.
-- ============================================================

CREATE TABLE legal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('terms', 'privacy')),
  version TEXT NOT NULL,
  contenido TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  is_substantial BOOLEAN NOT NULL DEFAULT false,
  resumen_cambios TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_documents_vigencia_ok CHECK (
    valid_to IS NULL OR valid_to > valid_from
  )
);

-- Una sola versión vigente por tipo
CREATE UNIQUE INDEX legal_documents_tipo_vigente_unique
  ON legal_documents (tipo) WHERE valid_to IS NULL;

-- Historial por tipo (para el "qué cambió" y la comparación de versiones)
CREATE INDEX legal_documents_tipo_fecha_idx
  ON legal_documents (tipo, valid_from DESC);

-- ============================================================
-- 3. TABLA: user_agreements (append-only real)
--    INSERT solo para service_role/postgres; SELECT propio para
--    authenticated vía policy; UPDATE/DELETE rechazados por trigger
--    para todos los roles, incluido service_role (bypassrls no lo
--    saltea). FK RESTRICT a auth.users: la depuración R-06 no puede
--    borrar aceptaciones (retención 5 años).
-- ============================================================

CREATE TABLE user_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy', 'marketing')),
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip INET NOT NULL,
  user_agent TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "¿aceptó la versión vigente?" y export del log (append-only, sin UPDATE)
CREATE INDEX user_agreements_user_tipo_fecha_idx
  ON user_agreements (user_id, document_type, accepted_at DESC);

-- Export por documento/versión
CREATE INDEX user_agreements_documento_vers_idx
  ON user_agreements (document_type, document_version);

-- ============================================================
-- 4. TABLA: solicitudes_arrepentimiento
--    Traza del POST público /legal/arrepentimiento (Res. 424/2020).
--    El endpoint es público pero la escritura pasa por BE como rol de
--    servidor; no hay policies para anon/authenticated. El codigo
--    (ARR-0001…) lo genera un trigger con secuencia propia.
-- ============================================================

CREATE SEQUENCE solicitudes_arrepentimiento_codigo_seq;

CREATE TABLE solicitudes_arrepentimiento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  detalle TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado estado_arrepentimiento NOT NULL DEFAULT 'recibida',
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consultas operativas (listado por contacto / por fecha)
CREATE INDEX solicitudes_arrepentimiento_email_idx
  ON solicitudes_arrepentimiento (email);

CREATE INDEX solicitudes_arrepentimiento_received_at_idx
  ON solicitudes_arrepentimiento (received_at);

-- ============================================================
-- 5. FUNCIÓN: has_accepted_current(user_id, document_type)
--    "¿el usuario aceptó la versión vigente de este documento?"
--    Match exacto por document_version (más fuerte que timestamp).
--    SECURITY DEFINER con search_path='' (regla del linter). No usa
--    auth.uid(): el user_id llega como argumento (reutilizable por BE
--    como RPC).
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_accepted_current(
  p_user_id UUID,
  p_document_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_agreements ua
    JOIN public.legal_documents ld
      ON ld.tipo = ua.document_type
     AND ld.valid_to IS NULL
    WHERE ua.user_id = p_user_id
      AND ua.document_type = p_document_type
      AND ua.accepted = true
      AND ua.document_version = ld.version
  );
$$;

-- ============================================================
-- 6. TRIGGER: no contratar sin aceptación vigente (decisión 2)
--    BEFORE INSERT en suscripciones para filas con usuario_id.
--    Para estudio_id no se define regla en este ciclo (pendiente
--    de BE/Producto). El orden del contrato FE queda: la aceptación
--    se registra ANTES del alta de suscripción.
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
      USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_suscripcion_aceptacion
  BEFORE INSERT ON suscripciones
  FOR EACH ROW EXECUTE FUNCTION public.validate_suscripcion_aceptacion();

-- ============================================================
-- 7. TRIGGER: append-only real en user_agreements (decisión 1)
--    Rechaza UPDATE/DELETE incondicionalmente. Un BEFORE trigger se
--    ejecuta siempre, incluso cuando el rol saltea RLS (service_role).
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_user_agreements_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'user_agreements es append-only: no se permite UPDATE ni DELETE'
    USING ERRCODE = '22000';
END;
$$;

CREATE TRIGGER user_agreements_no_update
  BEFORE UPDATE ON user_agreements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_agreements_modification();

CREATE TRIGGER user_agreements_no_delete
  BEFORE DELETE ON user_agreements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_agreements_modification();

-- ============================================================
-- 8. TRIGGER: generador de codigo en solicitudes_arrepentimiento
--    Patrón casos.codigo (server-owned), secuencia propia, ARR-0001…
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_arrepentimiento_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.codigo IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.codigo := 'ARR-'
    || lpad(nextval('public.solicitudes_arrepentimiento_codigo_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_arrepentimiento_codigo
  BEFORE INSERT ON solicitudes_arrepentimiento
  FOR EACH ROW EXECUTE FUNCTION public.assign_arrepentimiento_codigo();

-- ============================================================
-- 9. TRIGGERS: updated_at y auditoría (patrón del repo)
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON solicitudes_arrepentimiento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_legal_documents AFTER INSERT OR UPDATE OR DELETE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_arrepentimientos AFTER INSERT OR UPDATE OR DELETE ON solicitudes_arrepentimiento
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================================
-- 10. RLS: policies de las 3 tablas nuevas
--     legal_documents: SELECT público de la vigente (página pública
--       sin sesión). user_agreements: SELECT propio. Sin policies de
--       INSERT/UPDATE/DELETE (los grants resuelven el acceso; los
--       triggers bloquean UPDATE/DELETE). solicitudes_arrepentimiento:
--       sin policies (solo roles de servidor).
-- ============================================================

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_arrepentimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_documents_select_anon ON legal_documents
  FOR SELECT TO anon
  USING (valid_to IS NULL);

CREATE POLICY legal_documents_select_authenticated ON legal_documents
  FOR SELECT TO authenticated
  USING (valid_to IS NULL);

CREATE POLICY user_agreements_select_own ON user_agreements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 11. GRANTs explícitos (filosofía del repo, sin ALTER DEFAULT)
-- ============================================================

GRANT SELECT ON TABLE public.legal_documents TO anon, authenticated, service_role, postgres;

GRANT SELECT, INSERT ON TABLE public.user_agreements TO service_role, postgres;
GRANT SELECT ON TABLE public.user_agreements TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.solicitudes_arrepentimiento
  TO service_role, postgres;
GRANT USAGE ON SEQUENCE public.solicitudes_arrepentimiento_codigo_seq
  TO service_role, postgres;

-- REVOKE de EXECUTE por defecto (PUBLIC) — posture del linter
-- (20260811130000_linter_security_revoke.sql): trigger functions y
-- helpers sin EXPOSICIÓN al cliente. has_accepted_current se ejecuta
-- solo vía rol de servidor (el trigger la invoca); authenticated/anon
-- no la llaman como RPC.
REVOKE EXECUTE ON FUNCTION public.has_accepted_current(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_suscripcion_aceptacion()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_user_agreements_modification()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_arrepentimiento_codigo()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_accepted_current(uuid, text)
  TO service_role, postgres;

-- ============================================================
-- 12. SEEDS: legal_documents v1.0 (terms y privacy)
--     Contenido normalizado de mediacion-app/mocks/legal-texts.ts
--     (formato "## X. TÍTULO"). Los [COMPLETAR] quedan visibles —
--     bloqueo de Administración, no publicar la versión hasta
--     completarlos. valid_from = now() de la migración.
--     ON CONFLICT DO NOTHING: re-ejecución segura.
-- ============================================================

INSERT INTO public.legal_documents
  (tipo, version, contenido, valid_from, valid_to, is_substantial, resumen_cambios)
VALUES
  ('terms', 'v1.0', 'Los presentes Términos y Condiciones Generales de Uso y Contratación (en adelante, los “Términos y Condiciones”) regulan el acceso y la utilización de la Plataforma por parte del Usuario, así como la contratación de los Servicios a través de ella. La Plataforma es de propiedad de [COMPLETAR: razón social y tipo societario], CUIT [COMPLETAR: CUIT], con domicilio en [COMPLETAR: calle, número, localidad y provincia] (en adelante, la “Empresa”), y se encuentra disponible en [COMPLETAR: URL del sitio web] y en la aplicación móvil [COMPLETAR: nombre de la aplicación móvil].

Cualquier persona que desee acceder y/o usar la Plataforma y/o contratar los Servicios deberá sujetarse a estos Términos y Condiciones, junto con las demás políticas que rigen la Plataforma y los Servicios, que se incorporan al presente por referencia. CUALQUIER PERSONA QUE NO ACEPTE ESTOS TÉRMINOS Y CONDICIONES, LOS CUALES TIENEN CARÁCTER OBLIGATORIO Y VINCULANTE, DEBERÁ ABSTENERSE DE UTILIZAR LA PLATAFORMA Y LOS SERVICIOS.

La aceptación de estos Términos y Condiciones se perfecciona mediante un acto positivo, expreso e inequívoco del Usuario al momento de su registro. La mera navegación no importa aceptación de los presentes Términos y Condiciones ni perfeccionamiento de contrato alguno.

## A. DEFINICIONES

A.1. “Plataforma”: el sitio web y la aplicación móvil de titularidad de la Empresa individualizados en el encabezado, incluyendo sus subdominios, funcionalidades y desarrollos futuros.

A.2. “Servicios”: las funcionalidades, herramientas, prestaciones y planes ofrecidos por la Empresa a través de la Plataforma.

A.3. “Usuario”: toda persona humana o jurídica registrada en la Plataforma, cualquiera sea el carácter en que lo haga. Comprende al Usuario Particular, al Usuario Profesional y al Tercero Neutral. Las disposiciones referidas al Usuario se aplican a todos ellos, salvo que la cláusula distinga expresamente.

A.4. “Usuario Particular”: la persona humana mayor de dieciocho (18) años, con domicilio en la República Argentina y plena capacidad para contratar, o la persona jurídica constituida en la República Argentina actuando por medio de representante suficiente, que se registra en la Plataforma para gestionar un conflicto propio. Cuando el Usuario Particular sea una persona humana que contrata los Servicios como destinatario final, en beneficio propio o de su grupo familiar o social, le resulta aplicable el régimen de los arts. 1092 y siguientes del Código Civil y Comercial de la Nación y de la Ley 24.240.

A.5. “Usuario Profesional”: el abogado o estudio jurídico con título habilitante y matrícula vigente que se registra en la Plataforma a fin de gestionar Casos en representación o con el patrocinio de sus clientes. El Usuario Profesional contrata los Servicios con destino profesional. La relación entre la Empresa y el Usuario Profesional no constituye relación de consumo.

A.6. “Tercero Neutral”: el profesional humano habilitado que, con aceptación de ambas Partes, interviene en un Caso conforme la cláusula H.4, o que actúa como árbitro conforme la cláusula H.5. El Tercero Neutral se registra en la Plataforma con destino profesional.

A.7. “Parte”: la persona humana o jurídica titular del conflicto sometido a un Caso, que interviene en él por sí como Usuario Particular o representada o patrocinada por un Usuario Profesional. Las referencias a “las Partes” designan a las dos Partes enfrentadas en un mismo Caso.

A.8. “Parte Iniciadora”: la Parte que crea el Caso e invita a la otra a participar.

A.9. “Parte Requerida”: la Parte invitada a participar de un Caso creado por la Parte Iniciadora.

A.10. “Caso”: el expediente digital creado en la Plataforma que agrupa la información, las comunicaciones, las propuestas y, en su caso, el Acuerdo correspondientes a un conflicto determinado.

A.11. “Agente de Inteligencia Artificial”: el sistema automatizado incorporado a la Plataforma que asiste el desarrollo del Caso conforme al mecanismo de resolución seleccionado.

A.12. “Acuerdo”: el documento final generado por la Plataforma que refleja los términos consensuados por las Partes y suscripto por ellas mediante firma electrónica.

A.13. “Cuenta”: el perfil personal creado por el Usuario mediante el proceso de registro.

A.14. “Formulario”: el formulario de registro disponible en la Plataforma.

A.15. “Política de Privacidad”: el documento que rige el tratamiento de los datos personales, disponible en [COMPLETAR: URL de la Política de Privacidad] e incorporado a los presentes conforme la cláusula R.

## B. OBJETO

B.1. La Plataforma es una herramienta tecnológica destinada a facilitar la gestión y la resolución extrajudicial, voluntaria y consensuada de conflictos entre las Partes, mediante mecanismos de comunicación y negociación asistidos por un Agente de Inteligencia Artificial.

B.2. Podrán someterse a la Plataforma los conflictos referidos a: (i) relaciones de familia, incluyendo alimentos, régimen de comunicación, cuidado personal, plan de parentalidad y demás materias susceptibles de resolución consensuada; (ii) relaciones comerciales, contractuales y patrimoniales entre particulares, entre empresas o entre particulares y empresas, incluyendo cumplimiento e incumplimiento de contratos, cobro de sumas de dinero, prestación de servicios, locaciones y controversias societarias sobre derechos disponibles; (iii) relaciones de consumo, en los términos del art. 1092 del Código Civil y Comercial de la Nación; y (iv) toda otra materia de derecho privado susceptible de transacción conforme la legislación aplicable.

B.3. Quedan excluidas de la Plataforma las materias enumeradas en la cláusula I.

B.4. La utilización de la Plataforma tiene por finalidad facilitar la comunicación entre las Partes y promover soluciones consensuadas, sin que ello implique garantizar la celebración de acuerdos, la resolución del conflicto ni la obtención de un resultado determinado.

B.5. La utilización de la Plataforma no reemplaza, sustituye ni modifica los procedimientos prejudiciales obligatorios, los procesos judiciales o administrativos, ni ningún otro mecanismo cuya tramitación resulte exigida por la legislación aplicable, incluyendo la mediación prejudicial obligatoria de la Ley 26.589 y sus equivalentes provinciales, y el Servicio de Conciliación Previa en las Relaciones de Consumo cuando corresponda.

B.6. La Empresa actúa exclusivamente como proveedora de la infraestructura tecnológica, sin asumir la representación, defensa o asesoramiento de ninguna de las Partes, sin intervenir como juez, árbitro, mediador, conciliador o profesional del derecho, y sin ser parte del Acuerdo.

## C. ELEGIBILIDAD Y DECLARACIONES DEL USUARIO

C.1. Por medio de la aceptación de los presentes Términos y Condiciones, el Usuario declara que ha leído y comprende lo expuesto en el presente instrumento y que asume todas las obligaciones aquí dispuestas.

C.2. El Usuario declara que es mayor de dieciocho (18) años, que tiene plena capacidad para contratar y que se domicilia en el territorio de la República Argentina.

C.3. Cuando el registro corresponda a una persona jurídica, la persona humana que lo realiza declara contar con facultades suficientes para contratar en su nombre y representación y para obligarla conforme estos Términos y Condiciones.

C.4. El Usuario declara que el conflicto que somete a la Plataforma no se encuentra alcanzado por ninguno de los supuestos de exclusión de la cláusula I.

C.5. Las personas menores de dieciocho (18) años no pueden registrarse como Usuarios. Su situación jurídica podrá ser objeto del Acuerdo en tanto personas alcanzadas por sus efectos, pero nunca en calidad de parte contratante de los presentes Términos y Condiciones.

C.6. Cuando el ordenamiento jurídico reconozca a una persona adolescente legitimación para intervenir por sí en el conflicto, su participación sólo podrá canalizarse a través de un Usuario Profesional que actúe en su representación o patrocinio, quien será responsable de acreditar los presupuestos de dicha intervención. En ningún caso se habilitará el registro directo de una persona menor de edad.

## D. MODIFICACIÓN

D.1. La Empresa podrá modificar los presentes Términos y Condiciones a su exclusivo criterio y sin necesidad de invocar causa.

D.2. Toda modificación será comunicada con una antelación no menor a diez (10) días corridos a su entrada en vigencia, mediante correo electrónico dirigido a la dirección declarada por el Usuario en el Formulario y mediante aviso destacado en la Plataforma. En caso de no estar de acuerdo con las modificaciones, el Usuario podrá comunicar su voluntad de cerrar su Cuenta dentro de dicho plazo, vía correo electrónico a [COMPLETAR: casilla de bajas] o desde su perfil, sin costo ni penalidad alguna. Vencido el plazo sin manifestación en contrario, se considerará que el Usuario acepta los nuevos Términos y Condiciones.

D.3. Rige una única versión vigente de los presentes Términos y Condiciones para todos los Usuarios. Los Casos en trámite al momento de la entrada en vigencia de una modificación continuarán rigiéndose por ella, sin perjuicio del derecho de baja de la cláusula D.2.

D.4. La Empresa podrá realizar en cualquier momento, y sin necesidad de preaviso, modificaciones o actualizaciones de los contenidos, del diseño y de la configuración de la Plataforma.

## E. REGISTRO Y CUENTA

E.1. Los Servicios sólo podrán ser contratados por Usuarios que hayan creado una Cuenta, completando todos los campos obligatorios del Formulario con datos auténticos y actuales y adjuntando la documentación requerida.

E.2. El Usuario deberá completar el proceso de verificación de identidad mediante datos biométricos a fin de acceder a las funcionalidades que requieren identificación fehaciente, en las condiciones descriptas en la Política de Privacidad.

E.3. El Usuario Profesional y el Tercero Neutral deberán declarar y acreditar su matrícula vigente al momento del registro, y mantenerla actualizada durante toda la vigencia del vínculo. La acreditación de la matrícula es responsabilidad exclusiva del Usuario Profesional y del Tercero Neutral, quienes responden por la veracidad de lo declarado.

E.4. El Usuario asume la obligación de revisar y mantener actualizados sus datos. La Empresa no se responsabiliza por la veracidad de los datos declarados por los Usuarios. En caso de que el Usuario provea información falsa, incorrecta, desactualizada o incompleta, o de que la Empresa tenga base razonable de sospecha en tal sentido, podrá suspender la Cuenta previa intimación a subsanar en un plazo no menor a cinco (5) días hábiles, salvo supuestos de fraude manifiesto o riesgo para terceros, en los que la suspensión podrá ser inmediata.

E.5. El Usuario accederá a su Cuenta mediante su dirección de correo electrónico y una clave de seguridad personal, y se obliga a preservar la confidencialidad de esta última. El Usuario será responsable por las operaciones realizadas con su Cuenta, salvo que acredite que el acceso no autorizado se produjo por causa imputable a la Empresa.

E.6. El Usuario Profesional es responsable por el uso que de su Cuenta hagan sus socios, dependientes o colaboradores, y por el cumplimiento de sus deberes profesionales, incluido el secreto profesional.

E.7. La Empresa podrá dar de baja, en forma temporal o permanente, la Cuenta del Usuario que viole los presentes Términos y Condiciones, la Política de Privacidad o la legislación vigente, previa notificación con indicación de la causa, salvo que la notificación previa resulte incompatible con la naturaleza de la infracción o con una obligación legal.

E.8. La Empresa podrá rescindir los presentes Términos y Condiciones y dar de baja la Cuenta del Usuario, sin invocación de causa, mediante notificación cursada con una antelación no inferior a sesenta (60) días corridos. En tal caso el Usuario podrá descargar la totalidad de sus Acuerdos y documentación antes de la baja efectiva.

## F. NORMAS DE USO Y PROHIBICIONES

F.1. El Usuario se obliga a utilizar la Plataforma conforme a la ley, la moral, el orden público y los presentes Términos y Condiciones, a no emplearla para actividades ilícitas o que atenten contra derechos de terceros, y a actuar de buena fe en el desarrollo del Caso y en la celebración y ejecución del Acuerdo.

F.2. El Usuario tiene prohibido acceder a datos personales que no le estén destinados o ingresar a una Cuenta cuyo acceso no esté autorizado.

F.3. El Usuario tiene prohibido evaluar o probar la vulnerabilidad de la Plataforma o de su red, y violar sus medidas de seguridad o identificación sin autorización.

F.4. El Usuario tiene prohibido impedir o intentar impedir el servicio a cualquier otro Usuario, incluyendo el envío de software malicioso y la generación de saturación o ataques de denegación de servicio.

F.5. El Usuario tiene prohibido copiar, modificar, reutilizar, crear obras derivadas, descargar, adaptar, realizar ingeniería inversa, emular, migrar a otro servicio, traducir, compilar, descompilar o desensamblar la Plataforma o cualquiera de sus partes, sin consentimiento previo y escrito de la Empresa.

F.6. El Usuario tiene prohibido utilizar sistemas automatizados para extraer información de la Plataforma, y emplear el contenido de los Casos para entrenar sistemas de inteligencia artificial propios o de terceros.

F.7. El Usuario se obliga a mantener indemne a la Empresa conforme la cláusula Q ante el incumplimiento de las prohibiciones de esta cláusula.

## G. SERVICIOS

G.1. Para acceder a los Servicios el Usuario deberá crear un Caso, completando la información requerida por la Plataforma, incluyendo la identificación del tipo de conflicto, una descripción de los hechos que lo originan, la selección del mecanismo de resolución y la declaración jurada de la cláusula I.3.

G.2. La Parte Iniciadora podrá invitar a la otra Parte mediante el envío de un enlace de invitación generado por la Plataforma.

G.3. Con carácter previo al registro, la Parte Requerida accederá mediante el enlace de invitación a un resumen del Caso que le permita decidir con información suficiente si acepta participar. El resumen contendrá, como mínimo: la identificación de la Parte Iniciadora, el tipo de conflicto, la descripción de los hechos suministrada por aquélla, el mecanismo de resolución seleccionado, el plazo de vigencia de la invitación y la circunstancia de que la participación es gratuita para la Parte Requerida. El acceso al resumen no importa aceptación de los presentes Términos y Condiciones ni de la invitación.

G.4. Para participar del Caso, la Parte Requerida deberá crear una Cuenta o ingresar a la existente, aceptar los presentes Términos y Condiciones y suscribir la declaración jurada de la cláusula I.3. La aceptación de la invitación constituirá el consentimiento para iniciar el mecanismo de resolución seleccionado.

G.5. La invitación tendrá una vigencia de [COMPLETAR: plazo de vigencia de la invitación — a definir con el cliente según el flujo del producto] contada desde su envío. Vencido dicho plazo sin aceptación, el Caso quedará en estado “Caducado” y se aplicará lo dispuesto en la cláusula O.2.

G.6. Aceptada la invitación, cada Parte podrá exponer su versión de los hechos, manifestar su posición, aportar la información que considere pertinente y participar en las instancias de diálogo ofrecidas por la Plataforma, conforme al mecanismo elegido.

G.7. Cada Parte podrá ingresar de manera individual y confidencial la información relativa a su posición, incluyendo pretensiones, intereses, necesidades, prioridades y límites de negociación. Dicha información no será revelada, comunicada ni puesta a disposición de la otra Parte durante el desarrollo del Caso, salvo consentimiento expreso de quien la hubiera proporcionado.

G.8. Las Partes reconocen y aceptan que, por la naturaleza del procedimiento, las propuestas formuladas en el marco del Caso pueden permitir inferir de manera indirecta el rango de negociación declarado por la otra Parte.

G.9. El procedimiento podrá desarrollarse en una o varias rondas sucesivas hasta que las Partes alcancen un Acuerdo, alguna de ellas decida finalizarlo o concluya por cualquier otra causa prevista en los presentes Términos y Condiciones.

G.10. Cualquiera de las Partes podrá dar por terminado el Caso en cualquier momento anterior a la suscripción del Acuerdo, de manera unilateral, sin expresión de causa, sin necesidad de conformidad de la otra Parte y sin que ello genere responsabilidad alguna frente a la Empresa ni frente a la otra Parte. Este derecho se ejerce mediante una funcionalidad de acceso directo y permanente disponible en la vista del Caso, surte efecto de manera inmediata y no requiere explicación alguna. Su ejercicio no obsta a la aplicación de la cláusula O cuando corresponda.

G.11. El Usuario Profesional podrá gestionar Casos en representación o con el patrocinio de sus clientes, realizar las actuaciones habilitadas por la Plataforma y acceder a la información del Caso conforme a los permisos otorgados.

G.12. La intervención del Usuario Profesional requiere la autorización expresa de la Parte representada, otorgada a través de la funcionalidad prevista al efecto, con individualización de su alcance. La autorización podrá ser revocada por la Parte representada en cualquier momento, con efecto inmediato desde su registro en la Plataforma.

G.13. La Empresa no interviene en la relación profesional entre la Parte y el Usuario Profesional, ni garantiza la idoneidad, calidad, disponibilidad o resultados de los servicios jurídicos prestados, siendo dicha relación de exclusiva responsabilidad de las partes involucradas.

G.14. La información proporcionada por el Usuario será utilizada para la gestión del Caso y el funcionamiento de los Servicios, conforme a los presentes Términos y Condiciones y a la Política de Privacidad.

## H. MECANISMOS DE RESOLUCIÓN

H.1. La Parte Iniciadora selecciona el mecanismo de resolución al crear el Caso. Si el conflicto lo requiere y ambas Partes lo aceptan, podrá mutarse a otro mecanismo habilitado para la materia de que se trate.

H.2. Negociación directa asistida. Las Partes negocian entre sí a través de la Plataforma. El Agente de Inteligencia Artificial ordena el intercambio, estructura la información aportada y transmite las comunicaciones y las propuestas que cada Parte formula, sin acceder al contenido confidencial cargado por la otra Parte a los fines de elaborar propuestas propias y sin generar fórmulas de acuerdo. Las únicas propuestas que circulan son las que las Partes formulan por sí. No interviene un tercero humano.

H.3. Negociación asistida con facilitación. El Agente de Inteligencia Artificial accede a la información confidencial cargada por ambas Partes, la analiza, identifica coincidencias y divergencias, formula preguntas privadas a cada Parte y elabora propuestas de acuerdo propias, que ninguna de las Partes formuló y que se comunican simultáneamente a ambas. Las Partes podrán analizarlas, observarlas, modificarlas, aceptarlas o rechazarlas, sin acceder por ello a la información confidencial de la contraria. Ante la falta de acuerdo, el Agente de Inteligencia Artificial podrá elaborar nuevas propuestas considerando las observaciones formuladas. El Agente de Inteligencia Artificial carece de facultades para adoptar decisiones, imponer soluciones o emitir resoluciones obligatorias, y la aceptación, modificación o rechazo de toda propuesta corresponde exclusivamente a las Partes.

H.4. Negociación asistida con tercero neutral. Las Partes podrán incorporar un Tercero Neutral, con aceptación expresa de ambas. Al momento de su designación se determinarán su identidad, el alcance de sus permisos de acceso a la información del Caso, las propuestas que emita y el registro de sus intervenciones. El Tercero Neutral podrá facilitar el acercamiento entre las Partes, proponer fórmulas de arreglo y emitir opiniones no vinculantes. Su intervención no implica la adopción de decisiones obligatorias, y las Partes conservan la libertad de aceptar, rechazar o modificar cualquier propuesta.

H.5. Las Partes podrán someter a la decisión de uno o más árbitros las controversias comprendidas en la cláusula B.2, siempre que se trate de una relación jurídica de derecho privado, contractual o no contractual, en la que no se encuentre comprometido el orden público, conforme el art. 1649 del Código Civil y Comercial de la Nación.

H.5.1. El sometimiento a arbitraje requiere un acuerdo escrito, expreso e independiente entre las Partes, celebrado a través de la Plataforma con posterioridad a la aceptación de la invitación al Caso y suscripto por ambas mediante firma electrónica (el "Acuerdo Arbitral"). El Acuerdo Arbitral no constituye una cláusula de los presentes Términos y Condiciones, no se celebra con la Empresa y no puede tenerse por prestado por la aceptación de los presentes. La Plataforma no habilita el arbitraje sin la suscripción previa del Acuerdo Arbitral por las dos Partes.

H.5.2. El Acuerdo Arbitral individualiza, como mínimo: la relación jurídica y las controversias sometidas; si el arbitraje es de derecho o de amigables componedores; el número de árbitros y el procedimiento de designación; la sede; el idioma; el plazo para el dictado del laudo; el régimen de confidencialidad; y el modo de distribución de los costos, conforme los arts. 1652 y 1658 del Código Civil y Comercial de la Nación. A falta de estipulación expresa en contrario, el arbitraje es de derecho.

H.5.3. El tribunal arbitral se integra con un número impar de árbitros. Salvo estipulación en contrario en el Acuerdo Arbitral, actúa un árbitro único, designado de común acuerdo por las Partes. Si no lograran acordar, la designación es efectuada por [COMPLETAR].

H.5.4. El Agente de Inteligencia Artificial no ejerce ni puede ejercer funciones arbitrales, ni asistir al árbitro en la elaboración del laudo.

H.5.5. El árbitro no accede a la información confidencial que cada Parte hubiera cargado en el marco de las cláusulas H.2 o H.3, ni a las propuestas elaboradas en esa etapa. El arbitraje se sustancia exclusivamente sobre la base de la información que ambas Partes aporten en su transcurso, con conocimiento y posibilidad de contradicción recíprocas.

H.5.6. Los honorarios de los árbitros se pactan entre éstos y las Partes en el Acuerdo Arbitral. Su percepción se rige por la cláusula N.4.

H.5.7. El arbitraje ofrecido a través de la Plataforma es ad hoc. La Empresa no administra el arbitraje, no designa árbitros, no resuelve recusaciones, no controla plazos ni actuaciones, no integra el tribunal arbitral y no reviste el carácter de entidad administradora en los términos del art. 1657 del Código Civil y Comercial de la Nación. En consecuencia, no existe reglamento de entidad administradora que rija el proceso ni que integre el Acuerdo Arbitral: el procedimiento es el que las Partes estipulen en él y, a falta de estipulación, el que el tribunal arbitral considere apropiado, conforme el art. 1658 inc. c) del mismo cuerpo legal. El plazo para el dictado del laudo es el que las Partes fijen en el Acuerdo Arbitral y, en su defecto, el que establezca el derecho de la sede. La intervención de la Empresa se limita a proveer el soporte tecnológico que permite a las Partes suscribir el Acuerdo Arbitral, sustanciar el procedimiento y conservar sus constancias, sin que ello importe participación alguna en la controversia, en la designación del árbitro ni en el contenido del laudo, por los que la Empresa no responde.

H.6 No pueden someterse a arbitraje, conforme el art. 1651 del Código Civil y Comercial de la Nación: las controversias referidas al estado civil o a la capacidad de las personas; las cuestiones de familia; las vinculadas a derechos de usuarios y consumidores; las derivadas de contratos por adhesión, cualquiera sea su objeto; y las derivadas de relaciones laborales. Tampoco aquellas en que sea parte el Estado nacional, provincial o municipal.

H.6.1. En consecuencia, el arbitraje no se encuentra disponible en la Plataforma para los conflictos comprendidos en los incisos (i) y (iii) de la cláusula B.2, ni para los conflictos comprendidos en el inciso (ii) que deriven de un contrato por adhesión.

H.6.2. Al momento de crear el Caso, la Plataforma requiere a la Parte Iniciadora, y al aceptar la invitación a la Parte Requerida, la declaración de que la controversia no se encuentra alcanzada por la cláusula H.6. La falsedad de la declaración habilita la aplicación de la cláusula U.

H.7. Los mecanismos de las cláusulas H.2, H.3 y H.4 no constituyen mediación ni conciliación en los términos de la Ley 26.589 ni de las normas provinciales que regulan dichos institutos, ni sustituyen la mediación prejudicial obligatoria ni ningún otro procedimiento cuya realización resulte legalmente exigible.

H.8. La Empresa no garantiza que el procedimiento concluya con la celebración de un Acuerdo ni que las propuestas resulten aceptables para una o ambas Partes.

## I. SUPUESTOS EXCLUIDOS

I.1. LA PLATAFORMA NO PUEDE SER UTILIZADA CUANDO ENTRE LAS PARTES EXISTA, O SE INVOQUE, UNA SITUACIÓN DE VIOLENCIA FAMILIAR O DE VIOLENCIA POR RAZONES DE GÉNERO.

I.2. Quedan excluidos del ámbito de los Servicios los conflictos en los que concurra alguna de las siguientes circunstancias: (i) exista denuncia administrativa, policial o judicial por violencia familiar o por violencia por razones de género formulada por cualquiera de las Partes contra la otra, con independencia de su estado procesal; (ii) se encuentre vigente una medida cautelar, medida de protección, prohibición de acercamiento, exclusión del hogar o restricción de contacto respecto de alguna de las Partes; (iii) exista una situación de violencia física, psicológica, sexual, económica, patrimonial o simbólica en los términos de la Ley 26.485, aun cuando no hubiera sido denunciada; (iv) se trate de conflictos que involucren delitos de acción pública, medidas cautelares urgentes, cuestiones de estado civil o de capacidad de las personas, o cualquier otra materia excluida de los métodos autocompositivos por la legislación aplicable; (v) exista entre las Partes una asimetría de poder de tal entidad que impida a alguna de ellas negociar libremente.

I.3. Al crear el Caso y al aceptar la invitación, respectivamente, la Parte Iniciadora y la Parte Requerida deberán suscribir, mediante acto positivo y expreso, una declaración jurada en la que manifiesten que el conflicto no se encuentra alcanzado por ninguno de los supuestos de la cláusula I.2. La declaración quedará registrada en el Caso con constancia de fecha, hora y dispositivo. Su falsedad habilita a la Empresa a dar de baja el Caso y la Cuenta en forma inmediata, sin perjuicio de las responsabilidades que correspondan.

I.4. Ante la detección, denuncia o sospecha razonable de la existencia de alguno de los supuestos de la cláusula I.2, la Empresa suspenderá el procedimiento y dará de baja el Caso, impedirá toda comunicación ulterior entre las Partes a través de la Plataforma, informará a la Parte afectada, mediante un canal reservado y sin notificar a la otra Parte, la existencia de los canales oficiales de asistencia, incluida la Línea 144 de atención a mujeres en situación de violencia de género, y conservará la información del Caso a los fines de un eventual requerimiento judicial. La Plataforma cuenta con un canal de alerta accesible de manera permanente y discreta desde la vista del Caso.

I.5. La terminación del Caso por aplicación de esta cláusula no obsta al derecho de cualquiera de las Partes de terminarlo unilateralmente conforme la cláusula G.10, que se ejerce en todos los Casos y cualquiera sea su causa.

I.6. La Empresa no efectúa evaluación de riesgo ni diagnóstico de situaciones de violencia. Las previsiones de esta cláusula constituyen medidas de resguardo y no sustituyen la intervención de los organismos competentes.

J. ACUERDO, FIRMA ELECTRÓNICA Y EJECUTABILIDAD

J.1. Alcanzado el consenso, la Plataforma podrá generar un documento final que refleje los términos del Acuerdo conforme a la información suministrada por las Partes. El Acuerdo, al igual que todo el procedimiento, tiene carácter voluntario, y su aceptación y formalización corresponden exclusivamente a las Partes, únicas responsables de su contenido, alcance, validez y cumplimiento.

J.2. Con carácter previo a la generación del Acuerdo, la Plataforma podrá efectuar un chequeo referencial y no vinculante de sus términos contra una base de parámetros normativos y valores de referencia. Dicho chequeo constituye una ayuda informativa automatizada, no configura un control de legalidad, no sustituye el asesoramiento jurídico profesional y no implica validación, aprobación ni garantía de legalidad, validez, equidad o ejecutabilidad del Acuerdo. Esta advertencia se exhibe en la Plataforma al momento de mostrarse el resultado del chequeo.

J.3. El Acuerdo será suscripto a través de la Plataforma mediante firma electrónica, en los términos del art. 288 del Código Civil y Comercial de la Nación y del art. 5 de la Ley 25.506, previa verificación de la identidad de los firmantes mediante los mecanismos de validación implementados por la Empresa.

J.4. Las Partes reconocen y aceptan expresamente que la firma electrónica no goza de la presunción de autoría ni de integridad que la Ley 25.506 reconoce a la firma digital, y que, en caso de ser desconocida, corresponde a quien la invoca acreditar su validez.

J.5. La Plataforma registra y conserva, respecto de cada Acuerdo suscripto, el documento firmado y el registro cronológico de las actuaciones del Caso, incluyendo la fecha, la hora y el resultado de la verificación de identidad de cada firmante (la “Evidencia”). La Evidencia se conserva por el plazo de [COMPLETAR: plazo de conservación de la Evidencia — recomendado no inferior a diez años; confirmar con el cliente qué registros genera efectivamente el sistema] y podrá ser solicitada por cualquiera de las Partes.

J.6. El Acuerdo suscripto podrá ser descargado, conservado y presentado por cualquiera de las Partes ante las autoridades administrativas o judiciales competentes, cuando ello resulte procedente conforme a la legislación aplicable.

J.7. El Acuerdo, como instrumento privado, no constituye por sí mismo título ejecutivo. Tratándose de derechos disponibles y de conflictos que no comprometan el orden público, las Partes podrán dotarlo de fuerza ejecutiva por cualquiera de las vías que la legislación prevé, a saber: (i) su elevación a escritura pública, en cuyo caso reviste el carácter de instrumento público; (ii) el reconocimiento de firma en los términos del régimen procesal aplicable, a los fines de la preparación de la vía ejecutiva; (iii) su homologación judicial; o (iv) el dictado de un laudo arbitral conforme la cláusula H.5. La elección y la gestión de la vía corresponden exclusivamente a las Partes.

J.8. LOS ACUERDOS QUE INVOLUCREN DERECHOS DE NIÑAS, NIÑOS O ADOLESCENTES —INCLUYENDO ALIMENTOS, CUIDADO PERSONAL, RÉGIMEN DE COMUNICACIÓN Y PLAN DE PARENTALIDAD— REQUIEREN HOMOLOGACIÓN JUDICIAL PARA PRODUCIR PLENOS EFECTOS Y SER EJECUTABLES, ASÍ COMO LA INTERVENCIÓN DEL MINISTERIO PÚBLICO EN LOS TÉRMINOS DEL ART. 103 DEL CÓDIGO CIVIL Y COMERCIAL DE LA NACIÓN. Esta advertencia se exhibe en la Plataforma con carácter previo a la suscripción de todo Acuerdo de esa naturaleza.

J.9. Todo Acuerdo que involucre derechos de niñas, niños o adolescentes deberá respetar su interés superior. Las Partes reconocen el derecho de aquéllos a ser oídos y a que su opinión sea tenida en cuenta conforme a su edad y grado de madurez, en los términos del art. 12 de la Convención sobre los Derechos del Niño, ratificada por Ley 23.849, y del art. 707 del Código Civil y Comercial de la Nación, derecho cuyo ejercicio deberá canalizarse ante la autoridad judicial o administrativa competente. El Acuerdo no homologado no resulta oponible ni ejecutable respecto de los derechos indisponibles de las personas menores de edad.

J.10. Cuando la normativa vigente exija la homologación judicial, la intervención de un profesional, de un mediador, de un conciliador o de cualquier otra autoridad competente para la validez, eficacia o ejecutabilidad del Acuerdo, será responsabilidad exclusiva de las Partes cumplir con dichos requisitos. La Empresa no garantiza que el Acuerdo produzca efectos jurídicos determinados.

## K. AUSENCIA DE ASESORAMIENTO JURÍDICO

K.1. LA EMPRESA NO PRESTA SERVICIOS DE ASESORAMIENTO JURÍDICO NI EJERCE LA ABOGACÍA. LA PLATAFORMA, EL AGENTE DE INTELIGENCIA ARTIFICIAL Y TODO CONTENIDO GENERADO POR ELLOS NO CONSTITUYEN ASESORAMIENTO LEGAL, OPINIÓN PROFESIONAL, PATROCINIO NI REPRESENTACIÓN LETRADA, Y NO SUSTITUYEN LA CONSULTA CON UN ABOGADO MATRICULADO.

K.2. Ninguna interacción del Usuario con la Plataforma o con el Agente de Inteligencia Artificial genera relación profesional abogado-cliente con la Empresa ni con sus integrantes, ni se encuentra amparada por el secreto profesional que rige dicha relación.

K.3. La Empresa recomienda al Usuario contar con asistencia letrada propia antes de suscribir cualquier Acuerdo. Esta recomendación se exhibe en la Plataforma con carácter previo a la firma.

K.4. Las referencias normativas, valores de referencia o parámetros que la Plataforma exhiba tienen carácter informativo y general, pueden encontrarse desactualizados o no resultar aplicables al caso concreto, y no constituyen asesoramiento.

## L. INTELIGENCIA ARTIFICIAL

L.1. El Usuario reconoce que el procedimiento se desarrolla con asistencia de un sistema automatizado. La Plataforma informa en cada instancia cuándo el Usuario interactúa con el Agente de Inteligencia Artificial y cuándo con una persona humana.

L.2. Las propuestas generadas por el Agente de Inteligencia Artificial constituyen sugerencias no vinculantes. Ninguna decisión que produzca efectos jurídicos sobre el Usuario se adopta sobre la base exclusiva de un tratamiento automatizado de datos. El Usuario tiene derecho a obtener una explicación de los criterios generales utilizados, a impugnar la propuesta y a solicitar su revisión por parte de una persona humana, conforme al art. 20 de la Ley 25.326.

L.3. La solicitud de revisión humana se canaliza a través de la Plataforma y es atendida en un plazo máximo de [COMPLETAR: plazo de respuesta de la revisión humana — a definir según la capacidad operativa del equipo].

L.4. El Agente de Inteligencia Artificial puede producir resultados inexactos, incompletos o inadecuados al caso concreto.

L.5. La suspensión, terminación o baja de un Caso por aplicación de la cláusula I es adoptada o confirmada por una persona humana.

## M. CONFIDENCIALIDAD

M.1. Todo lo actuado en el marco de un Caso, incluyendo posiciones, propuestas, observaciones, comunicaciones y documentación aportada, tiene carácter confidencial.

M.2. Las Partes se obligan recíprocamente a no invocar, ofrecer ni utilizar como prueba en sede judicial, administrativa o arbitral la información revelada, las propuestas formuladas ni las concesiones efectuadas por la otra Parte durante el procedimiento, con excepción de: (i) el Acuerdo suscripto y su Evidencia; (ii) la información que la Parte que la aportó autorice expresamente a divulgar; (iii) la información que deba revelarse por imperio de una orden judicial o de una obligación legal; (iv) los supuestos de la cláusula I.

M.3. El Tercero Neutral y los Usuarios Profesionales intervinientes quedan alcanzados por la obligación de confidencialidad de esta cláusula, sin perjuicio de los deberes que les impongan sus respectivos regímenes profesionales.

M.4. La obligación de confidencialidad subsiste por el plazo de cinco (5) años contados desde la finalización del Caso, cualquiera sea su causa.

## N. PRECIO Y FORMA DE PAGO

N.1. El Usuario Particular abona un precio por Caso. El precio se abona al momento de crear el Caso, puede variar según el tipo de conflicto y el mecanismo de resolución seleccionado, y es informado de manera clara y previa a la confirmación del pago. La Parte Requerida no abona suma alguna para aceptar la invitación ni para participar del Caso. El Caso se activa una vez acreditado el pago.

N.2. El Usuario Profesional abona una suscripción periódica que lo habilita a gestionar la cantidad de Casos correspondiente al plan contratado durante el período de vigencia. Los planes disponibles, su alcance y su precio se encuentran publicados en la Plataforma. El período de facturación es de [COMPLETAR: duración del período de facturación]. La suscripción se renueva automáticamente por períodos iguales, salvo cancelación conforme la cláusula O. El Usuario Profesional podrá cambiar de plan desde su perfil, con efecto a partir del período siguiente. [COMPLETAR: qué ocurre cuando el Usuario Profesional excede la cantidad de Casos incluidos en su plan]

N.3. Los precios se expresan en pesos argentinos e incluyen los impuestos aplicables.

N.4. Los honorarios del Tercero Neutral son convenidos directamente entre éste y las Partes y son ajenos a la contraprestación debida a la Empresa. La Empresa no percibe, administra, custodia ni transfiere fondos de terceros ni por cuenta y orden de terceros: el pago de dichos honorarios se instrumenta a través del procesador de pagos externo contratado por la Empresa, que acredita el importe directamente en la cuenta del Tercero Neutral, sin que los fondos ingresen en ningún momento al patrimonio ni a cuentas de titularidad de la Empresa.

N.5. Los pagos se procesan a través de un procesador de pagos externo, cuyos términos y condiciones el Usuario deberá aceptar. La Empresa no accede ni almacena los datos completos de la tarjeta de crédito o débito ni de la cuenta bancaria del Usuario. El Usuario garantiza que sólo suministrará información de pago válida y de la que sea titular o esté autorizado a utilizar.

N.6. Ante la imposibilidad de procesar un pago, la Empresa notificará al Usuario y podrá suspender la prestación de los Servicios hasta la regularización. Transcurridos treinta (30) días corridos desde la fecha límite sin regularización, la Empresa podrá cerrar la Cuenta, sin que ello afecte la conservación de los Acuerdos suscriptos ni de su Evidencia conforme la cláusula J.5. El cierre de la Cuenta no exime al Usuario del pago de las sumas devengadas e impagas.

N.7. La Empresa podrá modificar los precios y los planes a su exclusivo criterio. Toda modificación se aplicará no antes de los treinta (30) días corridos de su notificación al Usuario, quien podrá cancelar la suscripción sin costo dentro de dicho plazo. Las modificaciones no afectan los Casos ya abonados ni los períodos de suscripción ya facturados.

N.8. Todos los Servicios se facturan digitalmente. El Usuario autoriza la recepción de comprobantes fiscales electrónicos en la dirección de correo declarada en el Formulario.

O. REVOCACIÓN, CANCELACIÓN Y BAJA

O.1. EL USUARIO PARTICULAR QUE REVISTA EL CARÁCTER DE CONSUMIDOR TIENE DERECHO A REVOCAR LA ACEPTACIÓN DE LA CONTRATACIÓN DENTRO DE LOS DIEZ (10) DÍAS CORRIDOS CONTADOS A PARTIR DE LA CELEBRACIÓN DEL CONTRATO, SIN RESPONSABILIDAD ALGUNA Y SIN NECESIDAD DE EXPRESAR CAUSA, CONFORME LOS ARTS. 1110 A 1116 DEL CÓDIGO CIVIL Y COMERCIAL DE LA NACIÓN Y EL ART. 34 DE LA LEY 24.240. EL EJERCICIO DE ESTE DERECHO ES SIN COSTO PARA EL USUARIO. La revocación se ejerce mediante el botón de arrepentimiento disponible en la página de inicio de la Plataforma, conforme la Resolución 424/2020 de la Secretaría de Comercio Interior, o mediante comunicación a [COMPLETAR: casilla de contacto].

O.2. Mientras la Parte Requerida no haya aceptado la invitación, la Parte Iniciadora podrá desistir del Caso y obtener el reintegro íntegro del precio abonado. Igual derecho le asiste cuando la invitación caduque por vencimiento del plazo de la cláusula G.5. El reintegro se practica por el mismo medio de pago utilizado, dentro de los diez (10) días hábiles de solicitado, y la Parte Iniciadora podrá optar por su acreditación como crédito aplicable a un nuevo Caso.

O.3. Aceptada la invitación por la Parte Requerida, el Servicio se considera comenzado. En tal supuesto, y cuando el Usuario Particular hubiera solicitado expresamente el inicio de la ejecución durante el plazo de revocación de la cláusula O.1, pierde el derecho a solicitar la revocación.

O.4. El Usuario profesional podrá cancelar la suscripción en cualquier momento desde su perfil o mediante el botón de baja disponible en la página de inicio de la Plataforma, y continuará teniendo acceso al Servicio hasta el final del período de facturación en curso, al término del cual la Cuenta se cerrará automáticamente. La cancelación no requiere expresión de causa ni gestión adicional alguna, y no se condiciona a la cancelación de sumas adeudadas.

O.5. No se otorgarán reembolsos por períodos de suscripción parcialmente utilizados.

O.6. El Usuario podrá descargar la totalidad de sus Acuerdos, documentación y Evidencia con anterioridad al cierre de la Cuenta, del que será notificado con una antelación no menor a quince (15) días corridos.

O.7. El cierre de la Cuenta no afecta la conservación de los Acuerdos suscriptos ni de su Evidencia por el plazo previsto en la cláusula J.5, que se mantendrán accesibles a solicitud del Usuario.

O.8. El cierre de la Cuenta durante la tramitación de un Caso implicará su finalización, lo que será notificado a la otra Parte.

O.9. El régimen de conservación y supresión de los datos personales se rige por la Política de Privacidad.

## P. LIMITACIÓN DE RESPONSABILIDAD

P.1. La Empresa no garantiza la disponibilidad y continuidad ininterrumpidas de la operación de la Plataforma ni la ausencia total de fallas de funcionamiento.

P.2. La Empresa no responde por los daños que sean consecuencia de caso fortuito o fuerza mayor, en los términos de los arts. 1730 y concordantes del Código Civil y Comercial de la Nación, ni por el hecho de un tercero por quien no deba responder.

P.3. La Empresa no responde por el contenido, alcance, validez, equidad, conveniencia ni cumplimiento del Acuerdo alcanzado por las Partes, ni por las consecuencias derivadas de su falta de homologación cuando ésta resulte exigible, ni por la conducta de las Partes entre sí.

P.4. La Empresa no responde por los actos u omisiones del Tercero Neutral ni del Usuario Profesional interviniente, cuya relación con las Partes es ajena a la Empresa.

P.5. Respecto del Usuario Profesional y del Tercero Neutral, y en la máxima medida permitida por la legislación aplicable, la responsabilidad total y agregada de la Empresa por cualquier reclamo derivado de o vinculado con los Servicios no excederá el mayor de los siguientes importes: el equivalente a lo efectivamente abonado por dicho Usuario a la Empresa durante los doce (12) meses anteriores al hecho generador de la responsabilidad, o el equivalente a diez (10) Salarios Mínimos Vitales y Móviles vigentes al momento del reclamo. Este límite no resulta aplicable en caso de dolo o culpa grave de la Empresa, ni en caso de daños a la persona.

P.6. La limitación de la cláusula P.5 no resulta aplicable al Usuario Particular que revista el carácter de consumidor, respecto de quien rige el régimen de responsabilidad de la Ley 24.240 y del Código Civil y Comercial de la Nación, sin limitación convencional alguna.

P.7. Nada de lo dispuesto en esta cláusula limita las garantías no renunciables ni los derechos de protección al consumidor que asistan al Usuario conforme a la legislación imperativa aplicable.

## Q. INDEMNIDAD

Q.1. El Usuario mantendrá indemne a la Empresa, así como a sus directores, administradores, representantes y dependientes, por todo reclamo administrativo o judicial iniciado por la otra Parte, por terceros o por cualquier organismo, que tenga por causa el incumplimiento por parte del Usuario de los presentes Términos y Condiciones o de la legislación aplicable, o la falsedad de las declaraciones prestadas conforme las cláusulas C e I.3.

Q.2. Esta obligación de indemnidad no alcanza a los reclamos que tengan por causa el dolo o la culpa grave de la Empresa, ni el incumplimiento por parte de ésta de sus obligaciones legales o contractuales.

Q.3. La Empresa notificará al Usuario todo reclamo alcanzado por esta cláusula dentro de los diez (10) días hábiles de recibido y permitirá su participación en la defensa. La Empresa no celebrará transacción alguna que obligue al Usuario sin su conformidad previa.

## R. PROTECCIÓN DE DATOS PERSONALES

R.1. El tratamiento de los datos personales recolectados a través de la Plataforma se rige íntegramente por la Política de Privacidad, disponible en [COMPLETAR: URL de la Política de Privacidad], que forma parte integrante de los presentes Términos y Condiciones y se incorpora a ellos por referencia.

R.2. La aceptación de los presentes Términos y Condiciones importa la aceptación de la Política de Privacidad. El Usuario declara haberla leído y comprendido con carácter previo a su registro.

R.3. La Política de Privacidad identifica al responsable del tratamiento, las categorías de datos recolectados y su origen, las finalidades y bases de licitud, el tratamiento de los datos biométricos, los plazos de conservación, los destinatarios y encargados, las transferencias internacionales, el tratamiento de los datos de niñas, niños y adolescentes, el procedimiento de ejercicio de los derechos de acceso, rectificación, actualización, supresión y oposición, y el organismo de control competente.

R.4. En materia de datos personales, la Política de Privacidad prevalece sobre los presentes Términos y Condiciones.

## S. PROPIEDAD INTELECTUAL Y LICENCIA

S.1. La Empresa otorga al Usuario una licencia limitada, no exclusiva, intransferible, revocable y no sublicenciable para acceder y utilizar la Plataforma conforme a los presentes Términos y Condiciones, con el fin exclusivo de utilizar los Servicios.

S.2. La licencia no implica cesión de derecho de propiedad intelectual alguno sobre el software, el código fuente, las bases de datos, la arquitectura funcional, las marcas, diseños, logos o contenidos de la Plataforma, que permanecen en todo momento como propiedad exclusiva de la Empresa o de sus legítimos licenciantes.

S.3. El Usuario se compromete a no utilizar, bajo ninguna forma, las marcas, solicitudes de marcas, patentes, modelos de utilidad, modelos y diseños industriales, insignias, logotipos, isotipos, nombres comerciales, nombres de dominio, know how y demás derechos de propiedad intelectual e industrial de la Empresa, sin autorización previa y por escrito.

S.4. La Empresa podrá suspender o revocar la licencia en caso de uso indebido o incumplimiento de los presentes Términos y Condiciones, conforme la cláusula U.

## T. CONTENIDO DEL USUARIO

T.1. El Usuario conserva la titularidad de todo contenido, información y documentación que incorpore a la Plataforma.

T.2. El Usuario otorga a la Empresa una licencia limitada, no exclusiva y gratuita para alojar, reproducir y procesar dicho contenido con el fin exclusivo de prestar los Servicios contratados y por el tiempo necesario a tal efecto. Esta licencia no habilita a la Empresa a utilizar el contenido con fines promocionales, comerciales o publicitarios.

T.3. La licencia de la cláusula T.2 se extingue con el cierre de la Cuenta, sin perjuicio de la conservación prevista en la cláusula J.5 y en la Política de Privacidad.

T.4. El Usuario garantiza que cuenta con los derechos necesarios sobre el contenido que incorpora y que su utilización en la Plataforma no infringe derechos de terceros.

T.5. [COMPLETAR: definir con el cliente si la Empresa producirá información agregada y disociada a partir del uso colectivo de la Plataforma —estadísticas, indicadores, informes o mejora del Agente de Inteligencia Artificial— y con qué alcance. De ser así, corresponde incorporar aquí la cláusula de datos generados por el uso.]

## U. SANCIONES

U.1. Sin perjuicio de otras medidas, la Empresa podrá advertir al Usuario, suspender temporalmente su Cuenta, inhabilitarla definitivamente y suspender la prestación de los Servicios, cuando se incumpla la ley o cualquiera de las estipulaciones de los presentes Términos y Condiciones, cuando se incumplan las obligaciones asumidas como Usuario, cuando no pudiere verificarse su identidad o la información proporcionada resultare falsa, cuando se incurriere en conductas o actos dolosos o fraudulentos, o cuando se verificare alguno de los supuestos de la cláusula I.

U.2. Salvo en los supuestos de dolo, fraude y de la cláusula I, la Empresa intimará previamente al Usuario a cesar en la conducta o subsanar el incumplimiento, otorgándole un plazo no menor a cinco (5) días hábiles e informándole la medida que se adoptará en caso contrario.

U.3. Toda medida adoptada será notificada al Usuario con indicación de su causa. El Usuario podrá formular descargo dentro de los diez (10) días hábiles, que será resuelto dentro de igual plazo.

U.4. La suspensión o inhabilitación de la Cuenta no priva al Usuario del derecho a descargar sus Acuerdos y su Evidencia, ni de los reintegros que correspondan por Servicios no prestados.

## V. INTERPRETACIÓN Y NULIDAD

V.1. En caso de declararse la nulidad de alguna de las cláusulas de los presentes Términos y Condiciones, tal nulidad no afectará la validez de las restantes, que mantendrán plena vigencia.

V.2. Los presentes Términos y Condiciones, la Política de Privacidad y todo documento referenciado en ellos constituyen la totalidad del acuerdo entre el Usuario y la Empresa.

V.3. La tolerancia de la Empresa respecto del incumplimiento del Usuario no podrá entenderse como renuncia a exigir su cumplimiento.

V.4. Los presentes Términos y Condiciones no crean asociación, unión transitoria, relación laboral, agencia ni franquicia entre el Usuario y la Empresa.

V.5. En caso de duda, los presentes Términos y Condiciones se interpretarán en el sentido más favorable al Usuario Particular que revista el carácter de consumidor, conforme el art. 1095 del Código Civil y Comercial de la Nación y el art. 37 de la Ley 24.240.

## W. DISPOSICIONES GENERALES

W.1. El Usuario no podrá ceder ni transferir su posición contractual, en todo ni en parte, sin conformidad previa y por escrito de la Empresa. La Empresa podrá ceder su posición contractual, en todo o en parte, en el marco de una reorganización societaria, fusión, escisión o transferencia de activos, sin necesidad de conformidad del Usuario, notificándolo con una antelación no menor a treinta (30) días corridos.

W.2. Sobreviven a la extinción del vínculo, cualquiera sea su causa, las cláusulas J.5, M, P, Q, S, T y X, y toda otra que por su naturaleza deba subsistir.

W.3. El Usuario constituye domicilio electrónico en la dirección de correo declarada en el Formulario, donde serán válidas todas las notificaciones que se le cursen. La Empresa constituye domicilio electrónico en [COMPLETAR: casilla de contacto] y domicilio en el indicado en el encabezado. Es carga del Usuario mantener actualizada su dirección de correo y revisar las notificaciones que reciba.

## X. JURISDICCIÓN Y LEY APLICABLE

X.1. Los presentes Términos y Condiciones se rigen en todos sus puntos por las leyes vigentes en la República Argentina.

X.2. Toda controversia derivada del presente acuerdo —incluidas su existencia, validez, interpretación, alcance o cumplimiento—  será sometida a los Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires, con renuncia a cualquier otro fuero o jurisdicción.

## Y. VIGENCIA Y CONTACTO

Y.1. Ante cualquier consulta, reclamo o solicitud vinculada con los Servicios, el Usuario podrá comunicarse a [COMPLETAR: casilla de contacto] o al [COMPLETAR: teléfono], de [COMPLETAR: días y horario de atención].

Y.2. Datos de la Empresa: [COMPLETAR: razón social] — CUIT [COMPLETAR: CUIT] — domicilio en [COMPLETAR: domicilio legal] — correo electrónico [COMPLETAR: casilla de contacto].

Y.3. Los presentes Términos y Condiciones fueron actualizados el [COMPLETAR: fecha]. Versión 1.0.', now(), NULL, false, NULL),
  ('privacy', 'v1.0', 'La presente Política de Privacidad y Protección de Datos Personales (la "Política") forma parte integrante de los Términos y Condiciones Generales de Uso y Contratación de la Plataforma (los "Términos y Condiciones") y se incorpora a ellos por referencia. La aceptación de los Términos y Condiciones importa la aceptación de la presente Política.

Los términos definidos en los Términos y Condiciones conservan en la presente Política el mismo significado. En particular: "Plataforma", "Empresa", "Servicios", "Usuario", "Usuario Particular", "Usuario Profesional", "Tercero Neutral", "Parte", "Caso", "Acuerdo", "Evidencia" y "Agente de Inteligencia Artificial".

En materia de datos personales, la presente Política prevalece sobre los Términos y Condiciones.

## A. RESPONSABLE DEL TRATAMIENTO

A.1. El responsable del tratamiento de los datos personales recolectados a través de la Plataforma es [COMPLETAR: razón social y tipo societario], CUIT [COMPLETAR: CUIT], con domicilio en [COMPLETAR: domicilio legal] (la "Empresa").

A.2. La Empresa determina las finalidades y los medios del tratamiento y responde por él en los términos de la Ley 25.326 de Protección de los Datos Personales y de sus normas reglamentarias y complementarias. La única excepción es la prevista en la cláusula G, respecto de los datos de terceros que el Usuario Profesional incorpora a la Plataforma.

A.3. Las consultas, solicitudes y reclamos vinculados con el tratamiento de datos personales se dirigen a [COMPLETAR: casilla del responsable de datos personales].

A.4. [COMPLETAR: La base de datos se encuentra inscripta en el Registro Nacional de Bases de Datos de la Agencia de Acceso a la Información Pública conforme el art. 21 de la Ley 25.326, bajo el número xxxxx]

## B. DATOS PERSONALES QUE SE TRATAN Y SU ORIGEN

B.1. La Empresa trata las siguientes categorías de datos personales, recolectados directamente de su titular:

B.2. Datos de identificación y contacto suministrados en el Formulario: nombre y apellido, número de documento nacional de identidad, CUIT o CUIL, razón social, domicilio, número de teléfono, dirección de correo electrónico y fotografía de perfil.

B.3. Datos biométricos obtenidos en el proceso de verificación de identidad, en las condiciones de la cláusula E.

B.4. Datos de la Cuenta y de la contratación: tipo de Usuario, plan contratado, historial de transacciones y comprobantes. Los datos completos de la tarjeta de crédito o débito y de la cuenta bancaria son tratados exclusivamente por el procesador de pagos externo, sin que la Empresa acceda a ellos ni los almacene.

B.5. Datos incorporados por las Partes en el marco de un Caso: la descripción del conflicto, la posición de cada Parte, sus pretensiones, intereses y límites de negociación, las comunicaciones intercambiadas, la documentación aportada y el Acuerdo suscripto.

B.6. Datos de uso y de conexión generados por la utilización de la Plataforma: fecha y hora de acceso, dirección IP, tipo de dispositivo y registro de actuaciones dentro del Caso.

B.7. La Empresa no recolecta datos de geolocalización.

B.8. Los datos incorporados por las Partes en el marco de un Caso pueden incluir información sensible en los términos del art. 2 de la Ley 25.326, así como datos de terceros, incluidas personas menores de edad. Su incorporación es voluntaria y responsabilidad de quien la efectúa, y se rige por las cláusulas F y G.

B.9. Los campos señalados como obligatorios en el Formulario son indispensables para la prestación de los Servicios. Su omisión impide el registro o el acceso a la funcionalidad de que se trate.

## C. FINALIDADES Y BASES DE LICITUD

C.1. Los datos personales son tratados con las siguientes finalidades, y sólo con ellas:

C.2. Registrar al Usuario, crear y administrar su Cuenta y verificar su identidad.

C.3. Prestar los Servicios: crear y gestionar el Caso, canalizar las comunicaciones entre las Partes, generar las propuestas conforme al mecanismo de resolución elegido, elaborar el Acuerdo y permitir su suscripción.

C.4. Generar y conservar la Evidencia de los Acuerdos suscriptos.

C.5. Gestionar el cobro de los Servicios y emitir los comprobantes fiscales correspondientes.

C.6. Cumplir con las obligaciones legales, fiscales y registrales a cargo de la Empresa y responder los requerimientos de autoridad competente.

C.7. Atender consultas, solicitudes y reclamos del Usuario.

C.8. Garantizar la seguridad de la Plataforma, prevenir el fraude y detectar los supuestos excluidos de la cláusula I de los Términos y Condiciones.

C.9. Enviar al Usuario las comunicaciones necesarias para la ejecución del contrato, en los términos de la cláusula P.

C.10. El tratamiento con las finalidades de las cláusulas C.2 a C.5 y C.9 tiene por base la ejecución del contrato del que el Usuario es parte. El tratamiento con las finalidades de las cláusulas C.6 y C.8 tiene por base el cumplimiento de una obligación legal y el interés legítimo de la Empresa. El tratamiento de los datos biométricos tiene por base el consentimiento específico de la cláusula E.

C.11. La Empresa no trata los datos personales del Usuario con finalidades publicitarias ni promocionales, ni cede sus datos a terceros con tales fines, salvo que el Usuario preste el consentimiento específico de la cláusula P.3.

C.12. Todo tratamiento con una finalidad distinta de las enumeradas requiere un nuevo consentimiento del titular.

## D. CONSENTIMIENTO

D.1. El consentimiento del titular es libre, expreso e informado, y se presta mediante un acto positivo al momento del registro, conforme el art. 5 de la Ley 25.326.

D.2. El consentimiento es revocable en cualquier momento, sin expresión de causa y sin efecto retroactivo. La revocación se solicita a la casilla indicada en la cláusula A.3 o a través de la funcionalidad prevista al efecto en la Plataforma.

D.3. La revocación del consentimiento respecto de un tratamiento indispensable para la prestación de los Servicios impide continuar utilizándolos y habilita el cierre de la Cuenta, sin costo para el Usuario. La revocación del consentimiento respecto de las finalidades de las cláusulas E y P.3 no afecta la prestación de los Servicios en lo demás.

## E. DATOS BIOMÉTRICOS

E.1. La Plataforma requiere la verificación de la identidad del Usuario mediante el tratamiento de datos biométricos, consistentes en la imagen del documento nacional de identidad y en la imagen del rostro captada al efecto, a partir de las cuales se genera una plantilla biométrica.

E.2. El tratamiento de los datos biométricos requiere el consentimiento libre, expreso, informado y específico del titular, prestado mediante un acto positivo diferenciado y separado de la aceptación de los Términos y Condiciones y de la presente Política. La Plataforma solicita ese consentimiento en una instancia propia, con carácter previo a la captura, e informa en ella el alcance del tratamiento.

E.3. La negativa a prestar el consentimiento de la cláusula E.2 impide el acceso a las funcionalidades que requieren identificación fehaciente, incluida la suscripción del Acuerdo, sin afectar el acceso a las restantes funcionalidades de la Plataforma.

E.4. Los datos biométricos son tratados con la finalidad única de verificar la identidad del Usuario al momento del registro y al momento de la firma del Acuerdo. Queda expresamente prohibido su tratamiento con cualquier otra finalidad, incluyendo la elaboración de perfiles, el análisis de emociones o de comportamiento, la publicidad, la cesión a terceros con fines distintos de la verificación y el entrenamiento de sistemas de inteligencia artificial.

E.5. La plantilla biométrica y las imágenes del documento nacional de identidad se conservan por el plazo de [COMPLETAR: plazo de conservación de la plantilla biométrica y de las imágenes del documento; no puede exceder el necesario para acreditar la identidad del firmante ante un eventual desconocimiento de firma] contado desde la última verificación, y se eliminan de manera irreversible al vencimiento de dicho plazo. El resultado de la verificación, con su fecha y hora, integra la Evidencia y se conserva conforme la cláusula L.4.

E.6. No se recolectan ni tratan datos biométricos de personas menores de dieciocho (18) años.

E.7. La verificación de identidad se realiza a través de [COMPLETAR: identificar al proveedor de verificación de identidad y su ubicación], que actúa como encargado del tratamiento en los términos de la cláusula J.

## F. DATOS DE NIÑAS, NIÑOS Y ADOLESCENTES

F.1. Las personas menores de dieciocho (18) años no pueden registrarse como Usuarios ni ser titulares de una Cuenta.

F.2. Los datos personales de niñas, niños y adolescentes pueden resultar incorporados a un Caso por las Partes, en tanto personas alcanzadas por los efectos del Acuerdo. Su incorporación es responsabilidad exclusiva de quien la efectúa, quien declara contar con facultades suficientes para hacerlo en ejercicio de la responsabilidad parental o de la representación legal que invoca.

F.3. Los datos de niñas, niños y adolescentes son tratados exclusivamente para la gestión del Caso en el que fueron incorporados, con acceso restringido a las Partes, a sus representantes y, en su caso, al Tercero Neutral designado.

F.4. Los datos de niñas, niños y adolescentes no son objeto de elaboración de perfiles, de cesión a terceros, de tratamiento con fines publicitarios ni de utilización para el entrenamiento de sistemas de inteligencia artificial, bajo ninguna circunstancia y aun mediando consentimiento del Usuario.

F.5. El tratamiento de estos datos se rige por el interés superior del niño y por los derechos reconocidos en la Convención sobre los Derechos del Niño, ratificada por Ley 23.849.

## G. DATOS DE TERCEROS INCORPORADOS POR EL USUARIO PROFESIONAL

G.1. Cuando el Usuario Profesional incorpora a la Plataforma datos personales de sus clientes o de terceros recolectados en el marco de su relación profesional, reviste respecto de esos datos el carácter de responsable del tratamiento, y la Empresa actúa como encargada del tratamiento por cuenta y orden de aquél, en los términos del art. 25 de la Ley 25.326.

G.2. Respecto de los tratamientos cuyas finalidades y medios determinan conjuntamente en el ámbito del Caso, la Empresa y el Usuario Profesional actúan como corresponsables, y cada uno responde por los incumplimientos que le sean imputables.

G.3. El Usuario Profesional garantiza que cuenta con base de licitud suficiente para incorporar dichos datos a la Plataforma, que ha informado a sus titulares las finalidades del tratamiento y la intervención de la Empresa, y que ha obtenido los consentimientos exigibles, incluido el correspondiente a datos sensibles cuando corresponda.

G.4. La Empresa no trata los datos de terceros incorporados por el Usuario Profesional con ninguna finalidad distinta de la prestación de los Servicios, no adopta decisiones autónomas sobre ellos y no los cede a terceros, salvo obligación legal.

G.5. Corresponde al Usuario Profesional atender las solicitudes de ejercicio de derechos que le dirijan los titulares de los datos por él incorporados. Cuando tales solicitudes sean dirigidas a la Empresa, ésta las derivará al Usuario Profesional dentro de los cinco (5) días hábiles, sin responderlas por sí y sin contactar al titular, salvo que una obligación legal disponga lo contrario.

G.6. El Usuario Profesional mantiene indemne a la Empresa por los reclamos derivados de la falta de base de licitud de los datos que hubiera incorporado, en los términos de la cláusula Q de los Términos y Condiciones.

G.7. Extinguido el vínculo, el Usuario Profesional podrá requerir la supresión de los datos de terceros tratados por su cuenta y orden o su devolución, con las excepciones de la cláusula L.

## H. INTELIGENCIA ARTIFICIAL

H.1. La Empresa no utiliza el contenido de los Casos ---posiciones, comunicaciones, documentación aportada ni Acuerdos--- para entrenar, reentrenar, ajustar ni mejorar sistemas de inteligencia artificial, propios o de terceros.

H.2. La utilización del contenido de los Casos con la finalidad indicada en la cláusula H.1 sólo procede mediante consentimiento previo, expreso y específico del Usuario, prestado a través de una opción de adhesión voluntaria disponible en su perfil, apagada por defecto, diferenciada de la aceptación de los Términos y Condiciones y de la presente Política, y revocable en cualquier momento sin consecuencia alguna sobre la prestación de los Servicios ni sobre su precio. El consentimiento de una Parte no alcanza al contenido aportado por la otra: el contenido de un Caso sólo puede utilizarse con esta finalidad si ambas Partes lo consintieron.

H.3. La Empresa exige contractualmente a los proveedores de servicios de inteligencia artificial que intervienen en la prestación de los Servicios la prohibición de utilizar el contenido de los Casos para entrenar sus modelos y de tratarlo con finalidades propias. [COMPLETAR: confirmar que los contratos con los proveedores de inteligencia artificial contienen efectivamente esa prohibición, y en qué modalidad de servicio están contratados. No publicar esta cláusula sin esa verificación.]

H.4. Las propuestas elaboradas por el Agente de Inteligencia Artificial constituyen sugerencias no vinculantes. Ninguna decisión que produzca efectos jurídicos sobre el Usuario se adopta sobre la base exclusiva de un tratamiento automatizado de datos.

H.5. El Usuario tiene derecho a conocer los criterios generales conforme a los cuales se elaboró una propuesta, a impugnarla y a solicitar su revisión por parte de una persona humana, conforme el art. 20 de la Ley 25.326. La solicitud se canaliza a través de la Plataforma y se responde en el plazo previsto en los Términos y Condiciones.

H.6. La suspensión o baja de un Caso por aplicación de la cláusula I de los Términos y Condiciones es adoptada o confirmada por una persona humana.

## I. INFORMACIÓN DISOCIADA

I.1. La Empresa puede elaborar estadísticas, indicadores y reportes agregados a partir de información previamente disociada, mediante procedimientos que impidan de manera irreversible la identificación de persona determinada o determinable.

I.2. La disociación se practica con un nivel de agregación tal que ninguna categoría de resultado pueda referirse a un número de Casos que permita la reidentificación.

I.3. La información así disociada no constituye dato personal en los términos del art. 2 de la Ley 25.326 y queda fuera del alcance de la presente Política. Su régimen se rige por los Términos y Condiciones.

I.4. La disociación no habilita el tratamiento previsto en la cláusula H.1, que requiere en todos los casos el consentimiento de la cláusula H.2.

## J. DESTINATARIOS Y ENCARGADOS DEL TRATAMIENTO

J.1. Los datos personales son comunicados exclusivamente a: la otra Parte del Caso y su representante, en la medida en que la funcionalidad de la Plataforma lo prevea y con las reservas de confidencialidad de los Términos y Condiciones; el Tercero Neutral designado, con el alcance de acceso que las Partes determinen; y los encargados del tratamiento enumerados en la cláusula J.2.

J.2. Los encargados del tratamiento comprenden a proveedores de alojamiento, proveedores de servicios de inteligencia artificial, proveedores de verificación de identidad, procesadores de pagos y proveedores de notificaciones por correo electrónico y mensajería.

J.3. Los encargados del tratamiento actúan por cuenta y orden de la Empresa, con sujeción a sus instrucciones, y no pueden aplicar ni utilizar los datos con una finalidad distinta de la prestación del servicio contratado ni cederlos a terceros, conforme el art. 25 de la Ley 25.326.

J.4. La Empresa puede revelar datos personales a la autoridad judicial o administrativa competente cuando medie requerimiento fundado en el ejercicio de sus atribuciones legales, y en los supuestos del art. 11 de la Ley 25.326.

J.5. Fuera de los supuestos previstos en esta cláusula, la Empresa no cede, vende ni transfiere datos personales a terceros.

## K. TRANSFERENCIA INTERNACIONAL

K.1. [COMPLETAR: indicar en qué países se encuentran radicados los servidores y los encargados del tratamiento. De esta respuesta depende íntegramente el contenido de esta cláusula.]

K.2. Cuando la prestación de los Servicios requiera la transferencia de datos personales fuera de la República Argentina, la Empresa la efectúa hacia países u organismos que la Agencia de Acceso a la Información Pública considera que brindan niveles adecuados de protección o, en su defecto, mediante la suscripción de los contratos modelo aprobados por la Disposición 60-E/2016 de dicha Agencia u otro mecanismo legalmente admitido, conforme el art. 12 de la Ley 25.326.

## L. PLAZOS DE CONSERVACIÓN

L.1. Los datos personales se conservan durante el tiempo necesario para cumplir las finalidades para las que fueron recolectados y, vencido éste, durante los plazos que la legislación imponga a la Empresa.

L.2. Los datos de identificación, contacto y Cuenta se conservan mientras la Cuenta permanezca activa y, cerrada ésta, por el plazo de prescripción de las acciones que puedan derivarse de la relación contractual, conforme el art. 2560 del Código Civil y Comercial de la Nación.

L.3. Los datos incorporados en un Caso que no hubiera concluido en un Acuerdo se suprimen [COMPLETAR: plazo de conservación de los Casos sin Acuerdo, contado desde su finalización o caducidad].

L.4. El Acuerdo suscripto y su Evidencia se conservan por el plazo previsto en los Términos y Condiciones, con independencia del cierre de la Cuenta, por resultar necesarios para acreditar la existencia, el contenido y la autoría del Acuerdo ante un eventual desconocimiento o ejecución. Vencido ese plazo, se suprimen.

L.5. Los datos biométricos se conservan por el plazo de la cláusula E.5.

L.6. Los comprobantes y registros contables e impositivos se conservan por los plazos que impone la legislación fiscal.

L.7. Vencidos los plazos aplicables, los datos se suprimen o se anonimizan de manera irreversible. Los datos cuya conservación resulte necesaria para el ejercicio o la defensa de derechos en un procedimiento en curso quedan bloqueados y se tratan exclusivamente a ese fin.

## M. SEGURIDAD Y CONFIDENCIALIDAD

M.1. La Empresa adopta las medidas técnicas y organizativas necesarias, según el nivel de seguridad adecuado al riesgo de los datos tratados, a fin de evitar su adulteración, pérdida, consulta o tratamiento no autorizado, conforme el art. 9 de la Ley 25.326.

M.2. Los datos personales son tratados como confidenciales. El personal de la Empresa y toda persona que intervenga en el tratamiento se encuentran alcanzados por el deber de confidencialidad del art. 10 de la Ley 25.326, que subsiste aun finalizada su relación con la Empresa.

M.3. La información que cada Parte carga con carácter confidencial en el marco de un Caso no es revelada a la otra Parte durante el desarrollo del procedimiento, en los términos de los Términos y Condiciones.

## N. INCIDENTES DE SEGURIDAD

N.1. Ante un incidente de seguridad que afecte datos personales y que sea susceptible de generar un riesgo para los derechos de sus titulares, la Empresa notifica a los Usuarios afectados y a la Agencia de Acceso a la Información Pública dentro de las setenta y dos (72) horas de tomado conocimiento del incidente.

N.2. La notificación informa, como mínimo: la naturaleza del incidente y su causa presunta; las categorías y el volumen aproximado de datos y de titulares afectados; las consecuencias conocidas o previsibles; las medidas adoptadas o propuestas para mitigarlas; los derechos que asisten a los titulares; y los datos de contacto para consultas ulteriores.

N.3. Cuando al vencimiento del plazo de la cláusula N.1 no se disponga de toda la información, la notificación se cursa igualmente con la información disponible y se completa a medida que se obtenga.

N.4. La Empresa lleva un registro interno de los incidentes de seguridad, de las medidas adoptadas y de las notificaciones cursadas.

## O. DERECHOS DEL TITULAR

O.1. El titular de los datos tiene derecho a acceder a sus datos personales y a obtener información sobre su origen y sobre el tratamiento realizado. El derecho de acceso puede ejercerse en forma gratuita en intervalos no inferiores a seis (6) meses, salvo que se acredite un interés legítimo, y se responde dentro de los diez (10) días corridos, conforme el art. 14 de la Ley 25.326.

O.2. El titular tiene derecho a la rectificación, actualización y supresión de sus datos cuando resulten inexactos, incompletos o cuando su tratamiento no se ajuste a la legislación aplicable. Estas solicitudes se resuelven dentro de los cinco (5) días hábiles, conforme el art. 16 de la Ley 25.326.

O.3. El titular tiene derecho a oponerse al tratamiento de sus datos cuando no exista un motivo legítimo que justifique su continuación, y a revocar el consentimiento prestado conforme la cláusula D.2.

O.4. El titular tiene derecho a impugnar las valoraciones que se funden exclusivamente en un tratamiento automatizado de datos, conforme la cláusula H.5 y el art. 20 de la Ley 25.326.

O.5. El ejercicio de los derechos es gratuito y no requiere expresión de causa, salvo el supuesto de la cláusula O.3. La solicitud se dirige a [COMPLETAR: casilla del responsable de datos personales] o al domicilio indicado en la cláusula A.1, e indica el nombre y apellido del solicitante, la petición concreta y un medio de contacto para la respuesta. La Empresa puede requerir información adicional únicamente cuando resulte estrictamente necesaria para acreditar la identidad del solicitante, y no exige documentación que exceda esa finalidad.

O.6. Cuando la solicitud se refiera a datos incorporados por un Usuario Profesional, se aplica la cláusula G.5.

O.7. El derecho de supresión no procede respecto de los datos cuya conservación resulte exigida por una obligación legal ni de los comprendidos en la cláusula L.4 mientras no venza su plazo de conservación.

## P. COMUNICACIONES ELECTRÓNICAS

P.1. La Empresa envía al Usuario las comunicaciones necesarias para la prestación de los Servicios, a saber: Invitación a un Caso, aceptación o rechazo de la invitación, propuestas disponibles, firma pendiente, Acuerdo finalizado, recordatorios de inactividad, comprobantes de pago, avisos de renovación y de modificación contractual, entre otros.

P.2. Las comunicaciones de la cláusula P.1 forman parte de la ejecución del contrato y no requieren consentimiento adicional. El Usuario no puede desactivarlas mientras mantenga su Cuenta activa, sin perjuicio de su derecho a darse de baja.

P.3. El envío de comunicaciones comerciales, promocionales o publicitarias requiere el consentimiento previo, expreso y específico del Usuario, prestado mediante una opción de adhesión voluntaria disponible en su perfil, apagada por defecto y revocable en cualquier momento. Su revocación no afecta la prestación de los Servicios. Toda comunicación de esta naturaleza incluye un mecanismo simple y gratuito de baja.

## Q. COOKIES Y TECNOLOGÍAS SIMILARES

Q.1. [COMPLETAR: enumerar las cookies y tecnologías similares que la Plataforma efectivamente utiliza, distinguiendo las técnicas o estrictamente necesarias de las analíticas y las publicitarias, con su finalidad, su titular y su plazo de vigencia. No redactar esta cláusula con un listado genérico.]

Q.2. Las cookies técnicas o estrictamente necesarias para el funcionamiento de la Plataforma se utilizan sin requerir consentimiento. Las cookies analíticas y publicitarias requieren el consentimiento previo del Usuario, que se solicita mediante un mecanismo de gestión disponible al primer acceso y modificable en cualquier momento.

Q.3. La aceptación de la presente Política no importa por sí sola la aceptación del uso de cookies no necesarias.

## R. ENLACES A SITIOS DE TERCEROS

R.1. La Plataforma puede incluir enlaces a sitios de terceros que no son operados por la Empresa. Los titulares de dichos sitios cuentan con sus propias políticas de privacidad y son responsables de sus propios tratamientos. La Empresa no responde por el tratamiento que aquéllos realicen.

## S. AUTORIDAD DE CONTROL

S.1. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.

S.2. El titular de los datos puede presentar su reclamo ante dicha Agencia, sin perjuicio de la tutela judicial efectiva y de la acción de protección de los datos personales prevista en el art. 33 de la Ley 25.326. La información de contacto de la Agencia se encuentra disponible en su sitio oficial ([[https://www.argentina.gob.ar/aaip/datospersonales]{.underline}](https://www.argentina.gob.ar/aaip/datospersonales)).

## T. MODIFICACIÓN DE LA POLÍTICA

T.1. La Empresa puede modificar la presente Política a su exclusivo criterio y sin necesidad de invocar causa.

T.2. Toda modificación se comunica con una antelación no menor a diez (10) días corridos a su entrada en vigencia, mediante correo electrónico dirigido a la dirección declarada por el Usuario y mediante aviso destacado en la Plataforma. Dentro de ese plazo el Usuario puede cerrar su Cuenta sin costo ni penalidad. Vencido el plazo sin manifestación en contrario, se considera que el Usuario acepta la nueva versión.

T.3. Rige una única versión vigente de la presente Política para todos los Usuarios.

## U. VIGENCIA Y CONTACTO

U.1. Las consultas vinculadas con la presente Política se dirigen a [COMPLETAR: casilla del responsable de datos personales] o al domicilio indicado en la cláusula A.1.

U.2. Datos de la Empresa: [COMPLETAR: razón social] — CUIT [COMPLETAR: CUIT] — domicilio en [COMPLETAR: domicilio legal].

U.3. La presente Política se encuentra vigente a partir del [COMPLETAR: fecha]. Versión 1.0.', now(), NULL, false, NULL)
ON CONFLICT DO NOTHING;
