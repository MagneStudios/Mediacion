-- Minimal Supabase-compatible surface, so the repo migrations can be applied to a
-- plain Postgres in CI.
--
-- The migrations depend on exactly four things Supabase provides and a bare
-- Postgres does not: the roles referenced by the GRANTs in
-- 20260721191651_tables.sql, the `auth` schema, `auth.users` (referenced by
-- usuarios.id and by the on_auth_user_created trigger), and `auth.uid()` — used
-- 124 times across the RLS policies.
--
-- This is deliberately a shim, not a Supabase clone. It exists so migrations can
-- run and be EXERCISED. `scripts/smoke_migrations.py` already checks that objects
-- exist, and that was not enough: audit_trigger_func existed and was still
-- broken, because `SET search_path = ''` plus an unqualified `auditoria` only
-- fails when the trigger actually fires.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles. NOLOGIN: nothing authenticates as these in CI, they only need to exist
-- for GRANT to resolve.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Shaped to match the columns the code and the integration suite actually use.
-- The migrations need only id, email and raw_user_meta_data, but the integration
-- specs insert rows the way Supabase Auth does — instance_id, aud, role,
-- encrypted_password, email_confirmed_at, raw_app_meta_data — so a table with
-- just three columns fails them with `column "instance_id" does not exist`.
--
-- Every added column is nullable or defaulted, so an insert naming only the
-- migration-relevant ones still works.
CREATE TABLE IF NOT EXISTS auth.users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id        UUID,
  aud                TEXT,
  role               TEXT,
  email              TEXT UNIQUE,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  raw_app_meta_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mirrors Supabase's own definition closely enough that a test can impersonate a
-- user with `SET request.jwt.claim.sub = '<uuid>'` and have RLS behave. Returns
-- NULL when unset, which is what an unauthenticated session looks like.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
