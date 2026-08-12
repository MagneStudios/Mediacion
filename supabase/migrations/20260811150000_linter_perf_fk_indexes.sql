-- ============================================================
-- Proyecto Mediación — Migration: fix linter PERF FK indexes
-- Fecha: 2026-08-11
-- Origen: docs/prompts-db/correccion-warnings-linter-supabase.md (Bloque 3)
--  16 FKs sin índice de cobertura → CREATE INDEX IF NOT EXISTS.
--  Aditiva pura, riesgo cero. No toca facturas.pago_id ni
--  envios_email.notificacion_id (ya tienen idx_facturas_pago_id e
--  idx_envios_email_notificacion_id).
-- Rollback: DROP INDEX por nombre (ver comentarios).
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fk_carpetas_estudio          ON carpetas(estudio_id);
CREATE INDEX IF NOT EXISTS idx_fk_caso_partes_usuario        ON caso_partes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fk_casos_carpeta              ON casos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_fk_estudios_plan              ON estudios(plan_id);
CREATE INDEX IF NOT EXISTS idx_fk_firmas_usuario             ON firmas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fk_incumplimientos_acuerdo    ON incumplimientos(acuerdo_id);
CREATE INDEX IF NOT EXISTS idx_fk_incumplimientos_reportante ON incumplimientos(reportante_id);
CREATE INDEX IF NOT EXISTS idx_fk_invitaciones_caso          ON invitaciones(caso_id);
CREATE INDEX IF NOT EXISTS idx_fk_items_parte                ON items(parte_id);
CREATE INDEX IF NOT EXISTS idx_fk_mediaciones_mediador       ON mediaciones(mediador_id);
CREATE INDEX IF NOT EXISTS idx_fk_pagos_suscripcion          ON pagos(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_fk_propuestas_ronda           ON propuestas(ronda_id);
CREATE INDEX IF NOT EXISTS idx_fk_respuestas_parte           ON respuestas_propuesta(parte_id);
CREATE INDEX IF NOT EXISTS idx_fk_suscripciones_plan         ON suscripciones(plan_id);
CREATE INDEX IF NOT EXISTS idx_fk_tareas_caso                ON tareas(caso_id);
CREATE INDEX IF NOT EXISTS idx_fk_usuarios_estudio           ON usuarios(estudio_id);
-- Rollback: DROP INDEX IF EXISTS idx_fk_carpetas_estudio;
--           DROP INDEX IF EXISTS idx_fk_caso_partes_usuario;
--           DROP INDEX IF EXISTS idx_fk_casos_carpeta;
--           DROP INDEX IF EXISTS idx_fk_estudios_plan;
--           DROP INDEX IF EXISTS idx_fk_firmas_usuario;
--           DROP INDEX IF EXISTS idx_fk_incumplimientos_acuerdo;
--           DROP INDEX IF EXISTS idx_fk_incumplimientos_reportante;
--           DROP INDEX IF EXISTS idx_fk_invitaciones_caso;
--           DROP INDEX IF EXISTS idx_fk_items_parte;
--           DROP INDEX IF EXISTS idx_fk_mediaciones_mediador;
--           DROP INDEX IF EXISTS idx_fk_pagos_suscripcion;
--           DROP INDEX IF EXISTS idx_fk_propuestas_ronda;
--           DROP INDEX IF EXISTS idx_fk_respuestas_parte;
--           DROP INDEX IF EXISTS idx_fk_suscripciones_plan;
--           DROP INDEX IF EXISTS idx_fk_tareas_caso;
--           DROP INDEX IF EXISTS idx_fk_usuarios_estudio;
