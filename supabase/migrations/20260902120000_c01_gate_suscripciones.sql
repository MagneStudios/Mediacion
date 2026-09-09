-- ============================================================
-- C-01: Gate de suscripciones — "ambos al día" para activar casos
-- ============================================================
-- Opción A del cliente: cada parte paga su propia suscripción.
-- El caso se habilita cuando ambas partes tienen suscripción activa.
-- ============================================================
-- Rollback (comentado):
--   DROP TRIGGER IF EXISTS trg_casos_gate_suscripciones ON casos;
--   DROP FUNCTION IF EXISTS public.caso_ambas_partes_suscripciones_activas(uuid);
--   ALTER TYPE estado_caso DROP VALUE IF EXISTS 'pendiente_suscripciones';
--   (el ADD VALUE es irreversible en la práctica; es aditivo y seguro)
-- ============================================================

-- 1. Nuevo valor de enum (irreversible en la práctica, aditivo y seguro)
ALTER TYPE estado_caso ADD VALUE IF NOT EXISTS 'pendiente_suscripciones';

-- 2. Función de verificación: ¿ambas partes del caso tienen suscripción activa?
CREATE OR REPLACE FUNCTION public.caso_ambas_partes_suscripciones_activas(
    p_caso_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total integer;
    v_activas integer;
BEGIN
    -- Contar partes vinculadas al caso (solo las dos partes en disputa;
    -- el mediador, rol 'mediador', no paga suscripción — RN-05 lo agrega
    -- desde ronda 3 y no debe bloquear la activación)
    SELECT count(*) INTO v_total
    FROM public.caso_partes
    WHERE caso_id = p_caso_id
      AND rol_en_caso IN ('parte_a', 'parte_b');

    -- Contar partes en disputa que tienen al menos una suscripción activa
    -- Resolución de suscripción efectiva: usuario directo O estudio (coalesce)
    SELECT count(*) INTO v_activas
    FROM public.caso_partes cp
    JOIN public.usuarios u ON u.id = cp.usuario_id
    WHERE cp.caso_id = p_caso_id
      AND cp.rol_en_caso IN ('parte_a', 'parte_b')
      AND EXISTS (
        SELECT 1
        FROM public.suscripciones s
        WHERE s.estado = 'activa'
          AND (
            s.usuario_id = u.id
            OR s.estudio_id = u.estudio_id
          )
      );

    -- Ambas partes al día → true; caso vacío → true
    RETURN v_activas >= v_total;
END;
$$;

-- 3. Trigger de gate: bloquea transición a activo/en_negociacion
CREATE OR REPLACE FUNCTION public.trg_casos_gate_suscripciones_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Solo aplica si el estado nuevo es activo o en_negociacion
    IF NEW.estado IN ('activo', 'en_negociacion') THEN
        -- En UPDATE: solo si el estado realmente cambia
        -- En INSERT: siempre (el estado se inserta directo)
        IF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado
           OR TG_OP = 'INSERT' THEN
            IF NOT public.caso_ambas_partes_suscripciones_activas(NEW.id) THEN
                RAISE EXCEPTION
                    'caso_bloqueado_suscripciones: ambas partes deben tener suscripción activa'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_casos_gate_suscripciones
    BEFORE INSERT OR UPDATE OF estado ON casos
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_casos_gate_suscripciones_fn();
