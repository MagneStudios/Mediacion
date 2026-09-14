-- ============================================================
-- Trazabilidad de moderación de lenguaje (server-only / append-only)
-- Rollback: DROP TABLE public.moderation_events;
-- ============================================================

CREATE TABLE moderation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  caso_id UUID REFERENCES casos(id) ON DELETE CASCADE,
  texto_detectado TEXT,
  accion TEXT NOT NULL,
  scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_usuario ON moderation_events(usuario_id);
CREATE INDEX idx_moderation_caso ON moderation_events(caso_id);

ALTER TABLE moderation_events ENABLE ROW LEVEL SECURITY;

-- Solo service_role escribe (bypass RLS). Admin autenticado puede leer para auditoría.
CREATE POLICY moderation_events_admin_select ON moderation_events
  FOR SELECT USING (public.is_admin());

CREATE POLICY moderation_events_service_insert ON moderation_events
  FOR INSERT TO service_role WITH CHECK (true);

-- Grants: SELECT a service_role/postgres/admin (vía RLS); escritura solo service_role/postgres.
GRANT SELECT ON TABLE public.moderation_events TO authenticated, service_role, postgres;
GRANT INSERT ON TABLE public.moderation_events TO service_role, postgres;

COMMENT ON TABLE moderation_events IS
  'Traza de detección de lenguaje ofensivo. Server-only: service_role escribe, is_admin() lee. '
  'texto_detectado se guarda completo (PII ofensivo, no expuesto a partes ni mediadores).';
COMMENT ON COLUMN moderation_events.accion IS 'bloqueado | avisado | permitido';
COMMENT ON COLUMN moderation_events.scores IS 'Resultados del modelo de moderación (p.ej. {"toxic":0.9}).';