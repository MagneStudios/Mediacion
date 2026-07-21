-- ============================================================
-- Proyecto Mediación — Migration 001: Extensions
-- Fecha: 2026-07-20
-- RN/CA: Base para gen_random_uuid()
-- Rollback: DROP EXTENSION IF EXISTS pgcrypto;
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";