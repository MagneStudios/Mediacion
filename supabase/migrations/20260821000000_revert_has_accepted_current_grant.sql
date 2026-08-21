-- ============================================================
-- MIGRACIÓN: Revertir GRANT EXECUTE de has_accepted_current a authenticated
-- Fecha: 2026-08-21
-- Objetivo: O1 — Resolver deuda técnica
-- ============================================================
-- Decisión: has_accepted_current es helper SECURITY DEFINER de servidor.
-- BE la llama vía selectNoFrom (20260814170000, sección "Permisos").
-- No hay caso de uso legítimo para que authenticated la invoque como RPC.
-- El GRANT a authenticated en 20260817140000 fue un fix de testing, no
-- una decisión de diseño. Se revierte aquí.
--
-- Rollback: GRANT EXECUTE ON FUNCTION public.has_accepted_current(UUID, TEXT)
--   TO authenticated;
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.has_accepted_current(UUID, TEXT)
  FROM authenticated;

-- Confirmar estado final de permisos
DO $$
BEGIN
  -- Verificar que authenticated ya NO tiene EXECUTE
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'has_accepted_current'
      AND pg_function_is_visible(p.oid)
  ) THEN
    RAISE NOTICE 'OK: has_accepted_current — EXECUTE solo para service_role/postgres';
  END IF;
END $$;
