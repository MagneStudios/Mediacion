-- ============================================================
-- Proyecto Mediación — Migration: cambios post-reunión 07/08/2026
-- Fecha: 2026-08-10
-- RN/CA: R-04 (TTL invitación 72h + estado expirado), R-05 (matrícula),
--        R-06 (anonimización post-baja), R-07 (pago_a_cargo),
--        R-09 (facturación ARCA), R-10 (ABM planes), R-12 (envios_email)
-- Reglas: aditiva, sin DROP, sin ALTER COLUMN TYPE. FKs sin CASCADE.
--         search_path = '' en funciones. CHECK no bloqueante.
-- Rollback: ver comentarios por sección
-- ============================================================

-- ============================================================
-- 1. ENUM: estado_caso + expirado (R-04)
--    Sin BEFORE/AFTER (riesgo de posición errónea con ADD VALUE)
-- ============================================================

ALTER TYPE estado_caso ADD VALUE 'expirado';
-- Rollback: no trivial (renombrar + recrear enum). No se revierte.

-- ============================================================
-- 2. USUARIOS: matrícula (R-05) + baja/anonimización (R-06)
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS numero_matricula TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS matricula_url TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS depuracion_programada_at TIMESTAMPTZ;
-- Rollback: ALTER TABLE usuarios DROP COLUMN numero_matricula, matricula_url,
--           fecha_baja, depuracion_programada_at;

-- ============================================================
-- 3. INVITACIONES: pago_a_cargo (R-07) — CHECK no bloqueante
-- ============================================================

ALTER TABLE invitaciones ADD COLUMN IF NOT EXISTS pago_a_cargo TEXT;
-- Rollback: ALTER TABLE invitaciones DROP COLUMN pago_a_cargo;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invitaciones_pago_a_cargo_check'
      AND conrelid = 'invitaciones'::regclass
  ) THEN
    ALTER TABLE invitaciones
      ADD CONSTRAINT invitaciones_pago_a_cargo_check
      CHECK (pago_a_cargo IN ('invitador', 'invitado'));
  END IF;
END;
$$;
-- Rollback: ALTER TABLE invitaciones DROP CONSTRAINT invitaciones_pago_a_cargo_check;

-- ============================================================
-- 4. PLANES: limite_casos nullable = ilimitado (R-10)
-- ============================================================

ALTER TABLE planes ALTER COLUMN limite_casos DROP NOT NULL;
-- Rollback: ALTER TABLE planes ALTER COLUMN limite_casos SET NOT NULL;

-- ============================================================
-- 5. FACTURAS (R-09) — FK sin CASCADE
-- ============================================================

CREATE TABLE IF NOT EXISTS facturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pago_id UUID NOT NULL REFERENCES pagos(id),
  numero TEXT,
  cae TEXT,
  url_pdf TEXT,
  neto NUMERIC(10,2),
  iva NUMERIC(10,2),
  impuestos NUMERIC(10,2),
  total NUMERIC(10,2),
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'facturas_estado_check'
      AND conrelid = 'facturas'::regclass
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT facturas_estado_check
      CHECK (estado IN ('pendiente', 'emitida', 'fallida'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_facturas_pago_id ON facturas(pago_id);
-- Rollback: DROP TABLE facturas CASCADE (quita tabla + índice + constraints);

-- ============================================================
-- 6. ENVIOS_EMAIL (R-12) — FK sin CASCADE
-- ============================================================

CREATE TABLE IF NOT EXISTS envios_email (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notificacion_id UUID NOT NULL REFERENCES notificaciones(id),
  intentos INT NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envios_email_notificacion_id ON envios_email(notificacion_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON envios_email
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Rollback: DROP TABLE envios_email CASCADE;

-- ============================================================
-- 7. SEED: plan Estudio (R-10) + configuración (R-04, R-09)
-- ============================================================

INSERT INTO planes (nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio)
VALUES ('estudio', 0, NULL, 0, 25.00)
ON CONFLICT (nombre) DO UPDATE
  SET limite_carpetas = EXCLUDED.limite_carpetas,
      limite_casos = EXCLUDED.limite_casos,
      limite_iteraciones_ia = EXCLUDED.limite_iteraciones_ia,
      precio = EXCLUDED.precio;

INSERT INTO configuracion (clave, valor, descripcion)
VALUES
  ('invitacion_ttl_horas', '72', 'Horas de vigencia de la invitación (R-04)'),
  ('impuestos', '{"AR":{"iva":21,"otros_impuestos":0}}', 'Impuestos por país (R-09)')
ON CONFLICT (clave) DO NOTHING;
-- Rollback: DELETE FROM planes WHERE nombre = 'estudio' AND limite_casos IS NULL;
--           DELETE FROM configuracion WHERE clave IN ('invitacion_ttl_horas', 'impuestos');

-- ============================================================
-- 8. MÁQUINA DE ESTADOS: nuevo/activo → expirado (R-04)
--    Preserva todas las transiciones existentes + search_path = ''
-- ============================================================

CREATE OR REPLACE FUNCTION validate_caso_estado_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'nuevo' AND NEW.estado IN ('activo', 'terminado', 'expirado') THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'activo' AND NEW.estado IN ('en_negociacion', 'terminado', 'vencido', 'expirado') THEN
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
-- Rollback: restaurar versión anterior desde 20260728200000_function_search_path.sql

-- ============================================================
-- 9. RLS tablas nuevas — 47 policies existentes intactas
--    (regla estricta #2 del pipeline)
-- ============================================================

-- FACTURAS: el titular ve sus facturas (vía suscripción → pago), admin ve todas
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY facturas_select_own ON facturas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pagos p
      JOIN suscripciones s ON s.id = p.suscripcion_id
      WHERE p.id = facturas.pago_id
        AND (s.usuario_id = (SELECT auth.uid()) OR s.estudio_id IN (
          SELECT e.id FROM estudios e JOIN usuarios u ON u.estudio_id = e.id
          WHERE u.id = (SELECT auth.uid())
        ))
    )
    OR is_admin()
  );

-- ENVIOS_EMAIL: solo admin lee; escritura vía service role (bypass RLS)
ALTER TABLE envios_email ENABLE ROW LEVEL SECURITY;

CREATE POLICY envios_email_select_admin ON envios_email
  FOR SELECT USING (is_admin());
-- Rollback: DROP POLICY facturas_select_own ON facturas;
--           DROP POLICY envios_email_select_admin ON envios_email;
--           ALTER TABLE facturas DISABLE ROW LEVEL SECURITY;
--           ALTER TABLE envios_email DISABLE ROW LEVEL SECURITY;
