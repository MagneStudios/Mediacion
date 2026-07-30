-- ============================================================
-- Proyecto Mediación — Migration: notificaciones.estado TEXT → enum
-- Fecha: 2026-07-28
-- RN/CA: Consistencia de patrón — todas las tablas con estados usan enums
-- Rollback: ALTER TABLE notificaciones ALTER COLUMN estado DROP DEFAULT;
--           ALTER TABLE notificaciones ALTER COLUMN estado TYPE TEXT USING estado::text;
--           ALTER TABLE notificaciones ALTER COLUMN estado SET DEFAULT 'pendiente';
--           DROP TYPE estado_notificacion;
-- ============================================================

-- Crear enum (mismos valores que el TEXT existente)
CREATE TYPE estado_notificacion AS ENUM (
  'pendiente', 'enviada', 'fallida'
);

-- Drop default, convertir TEXT → enum, re-add default
ALTER TABLE notificaciones ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE notificaciones
  ALTER COLUMN estado TYPE estado_notificacion
  USING estado::estado_notificacion;
ALTER TABLE notificaciones ALTER COLUMN estado SET DEFAULT 'pendiente'::estado_notificacion;
