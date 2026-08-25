-- ============================================================
-- Proyecto Mediación — Migración: Monetización Fase 1 (Pactum)
-- Fecha: 2026-08-21
-- Origen: docs/PACTUM-monetizacion-spec.md v1.0 (§4, §5.1)
-- Contrato: docs/contrato-spec-repo-monetizacion.md
-- Objetivo: O2 — Fundaciones de monetización adaptadas al schema actual.
--   Aditivo puro: no toca objetos existentes salvo ADD COLUMN / ADD VALUE.
-- Reglas: search_path='' en funciones SECURITY DEFINER · montos integer
--   minor units (nunca float) · escritura de facturación jamás desde cliente ·
--   GRANTs explícitos (sin ADP) · sin CASCADE hacia tablas legales.
-- Rollback:
--   DROP FUNCTION public.consume_quota(UUID, TEXT);
--   DROP TABLE public.payment_events;
--   DROP TABLE public.lawyer_requests;
--   DROP TABLE public.usage_counters;
--   ALTER TABLE public.suscripciones
--     DROP COLUMN current_period_start, DROP COLUMN current_period_end,
--     DROP COLUMN cancel_at_period_end, DROP COLUMN mp_preapproval_id,
--     DROP COLUMN mp_payer_email;
--   ALTER TABLE public.planes
--     DROP COLUMN max_negotiations_per_period, DROP COLUMN max_clients_per_period;
--   DROP TYPE public.estado_solicitud_abogado;
-- ============================================================

-- ============================================================
-- 1. ENUM: estado_suscripcion — agregar 'pausada' (spec: paused)
--    Los 4 valores del spec ya existen salvo paused:
--    activa, cancelada, vencida (past_due), pendiente_pago.
-- ============================================================

ALTER TYPE public.estado_suscripcion ADD VALUE IF NOT EXISTS 'pausada';

-- ============================================================
-- 2. ENUM: estado_solicitud_abogado (spec: lawyer_request_status)
-- ============================================================

CREATE TYPE public.estado_solicitud_abogado AS ENUM (
  'pendiente_pago', 'pagada', 'notificada', 'asignada', 'cerrada',
  'reembolsada', 'fallida'
);

-- ============================================================
-- 3. PLANES — columnas de cuota del spec (aditivo)
--    NULL = ilimitado. Las columnas legacy (limite_*) se conservan.
-- ============================================================

ALTER TABLE public.planes
  ADD COLUMN max_negotiations_per_period INTEGER,
  ADD COLUMN max_clients_per_period INTEGER;

-- ============================================================
-- 4. SUSCRIPCIONES — campos de billing/MercadoPago (aditivo)
--    Período anclado al día de alta (spec §5.2), nunca por cron.
-- ============================================================

ALTER TABLE public.suscripciones
  ADD COLUMN current_period_start TIMESTAMPTZ,
  ADD COLUMN current_period_end TIMESTAMPTZ,
  ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN mp_preapproval_id TEXT UNIQUE,
  ADD COLUMN mp_payer_email TEXT;

-- ============================================================
-- 5. TABLA: usage_counters — fuente de verdad de las cuotas
--    PK (usuario_id, period_start): el contador se lleva por usuario
--    real (spec §5.1.1), el período viene de la suscripción del pagador.
--    ON CONFLICT DO NOTHING en consume_quota crea la fila por período.
-- ============================================================

CREATE TABLE public.usage_counters (
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  negotiations_created INTEGER NOT NULL DEFAULT 0,
  clients_created INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, period_start)
);

-- Limpieza de períodos vencidos / métricas por período
CREATE INDEX idx_usage_counters_period_start
  ON public.usage_counters (period_start);

-- ============================================================
-- 6. TABLA: lawyer_requests — escalamiento a abogado (pago único)
--    Precio congelado en el click (spec §7.3): monto_minor + moneda.
--    Montos en integer minor units, nunca float.
-- ============================================================

CREATE TABLE public.lawyer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL REFERENCES auth.users(id),
  status public.estado_solicitud_abogado NOT NULL DEFAULT 'pendiente_pago',
  moneda TEXT NOT NULL CHECK (moneda IN ('ARS', 'USD')),
  monto_minor INTEGER NOT NULL,
  mp_preference_id TEXT,
  mp_payment_id TEXT UNIQUE,
  external_reference TEXT UNIQUE NOT NULL,
  case_summary TEXT,
  whatsapp_notified_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lawyer_requests_caso_id
  ON public.lawyer_requests (caso_id);

CREATE INDEX idx_lawyer_requests_status
  ON public.lawyer_requests (status);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.lawyer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. TABLA: payment_events — idempotencia de webhooks MP (spec §6.4)
--    Log append-only de eventos; el índice único (provider, event_type,
--    resource_id) hace idempotente el re-procesamiento.
-- ============================================================

CREATE TABLE public.payment_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  event_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  signature_ok BOOLEAN NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_events_provider_type_resource_unique
  ON public.payment_events (provider, event_type, resource_id);

-- ============================================================
-- 8. FUNCIÓN: consume_quota — enforcement transaccional de cuota
--    Spec §5.1. SECURITY DEFINER, search_path=''.
--    Errcodes: P0001 = NO_ACTIVE_SUBSCRIPTION / NO_BILLING_PERIOD
--              P0002 = QUOTA_EXCEEDED → BE traduce a HTTP 402
--    Defaults reversibles (documentados en decisiones-db):
--      #3: cliente de estudio hereda la cuota de negociaciones del plan
--          del estudio (estudio plan = 3/mes por cliente)
--      #4: flujo mensual — el contador se resetea creando una fila nueva
--          por período; no se borra nada, queda histórico.
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_quota(
  p_usuario_id UUID,
  p_kind TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_susc_id UUID;
  v_plan_id UUID;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  IF p_kind NOT IN ('negotiation', 'clients') THEN
    RAISE EXCEPTION 'INVALID_QUOTA_KIND'
      USING ERRCODE = '22023';
  END IF;

  -- Resolver la suscripción EFECTIVA (spec §5.1.1): la propia del usuario,
  -- o la del estudio que lo gestiona (usuarios.estudio_id). Se prefiere la
  -- propia. FOR UPDATE serializa consumo concurrente por suscripción.
  SELECT s.id, s.plan_id, s.current_period_start, s.current_period_end
    INTO v_susc_id, v_plan_id, v_start, v_end
  FROM public.suscripciones s
  JOIN public.usuarios u ON u.id = p_usuario_id
  WHERE (s.usuario_id = p_usuario_id
         OR (u.estudio_id IS NOT NULL AND s.estudio_id = u.estudio_id))
    AND s.estado IN ('activa', 'vencida')
  ORDER BY (s.usuario_id = p_usuario_id) DESC
  LIMIT 1
  FOR UPDATE OF s;

  IF v_susc_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_SUBSCRIPTION'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'NO_BILLING_PERIOD'
      USING ERRCODE = 'P0001';
  END IF;

  -- Contador por usuario real, período del pagador (default #4)
  INSERT INTO public.usage_counters (usuario_id, period_start, period_end)
  VALUES (p_usuario_id, v_start, v_end)
  ON CONFLICT (usuario_id, period_start) DO NOTHING;

  -- Incremento atómico: el UPDATE toma el lock de la fila del contador,
  -- dos requests simultáneas no pueden pasarse el límite (spec §12).
  IF p_kind = 'negotiation' THEN
    SELECT p.max_negotiations_per_period INTO v_limit
      FROM public.planes p
     WHERE p.id = v_plan_id;

    UPDATE public.usage_counters
       SET negotiations_created = negotiations_created + 1
     WHERE usuario_id = p_usuario_id
       AND period_start = v_start
     RETURNING negotiations_created INTO v_used;
  ELSE
    SELECT p.max_clients_per_period INTO v_limit
      FROM public.planes p
     WHERE p.id = v_plan_id;

    UPDATE public.usage_counters
       SET clients_created = clients_created + 1
     WHERE usuario_id = p_usuario_id
       AND period_start = v_start
     RETURNING clients_created INTO v_used;
  END IF;

  -- v_limit IS NULL ⇒ ilimitado (plan Corporativo). La excepción hace
  -- rollback del UPDATE: el contador nunca queda inflado (spec §5.1).
  IF v_limit IS NOT NULL AND v_used > v_limit THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ============================================================
-- 9. RLS + GRANTs
--    Regla: lectura owner, escritura solo service_role/postgres.
--    payment_events es de rol de servidor (patrón server-only).
-- ============================================================

-- 9a. usage_counters — SELECT propio + admin; escritura service_role
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_counters_select_own ON public.usage_counters
  FOR SELECT USING (
    usuario_id = auth.uid() OR is_admin()
  );

GRANT SELECT ON TABLE public.usage_counters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_counters
  TO service_role, postgres;

-- 9b. lawyer_requests — SELECT participantes del caso + admin
ALTER TABLE public.lawyer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY lawyer_requests_select_participants ON public.lawyer_requests
  FOR SELECT USING (
    is_part_of_case(caso_id) OR is_admin()
  );

GRANT SELECT ON TABLE public.lawyer_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lawyer_requests
  TO service_role, postgres;

-- 9c. payment_events — patrón server-only (sin policies)
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_events
  TO service_role, postgres;

-- 9d. consume_quota — solo roles de servidor (BE la llama con service_role)
REVOKE EXECUTE ON FUNCTION public.consume_quota(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_quota(UUID, TEXT)
  TO service_role, postgres;

-- ============================================================
-- 10. SEEDS: planes particular/estudio/corporativo (spec §3)
--     ON CONFLICT sobre nombre (UNIQUE existente). Columnas legacy
--     (limite_*) se completan con placeholders — se conservan intactas
--     para los planes existentes (base/simple/plus).
--     Nota: precio 0.00 para corporativo = "a consultar" (spec §3.3).
-- ============================================================

INSERT INTO public.planes
  (nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio,
   max_negotiations_per_period, max_clients_per_period)
VALUES
  ('particular', 1, NULL, 5, 19.90, 3, NULL),
  ('corporativo', -1, NULL, -1, 0.00, NULL, NULL)
ON CONFLICT (nombre) DO UPDATE
  SET max_negotiations_per_period = EXCLUDED.max_negotiations_per_period,
      max_clients_per_period = EXCLUDED.max_clients_per_period;

UPDATE public.planes
   SET max_negotiations_per_period = 3,
       max_clients_per_period = 20
 WHERE nombre = 'estudio';
