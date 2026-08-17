-- ============================================================
-- Proyecto Mediación — Migration: contador de rate limit compartido
-- Fecha: 2026-08-17
-- Origen: _bmad-output/implementation-artifacts/spec-tyc-cierre-pendientes.md (CAP-6)
-- Fuentes: docs/fichas-legal-backend.md §4 ("Limitación conocida: el contador
--            vive en memoria del proceso"),
--          docs/pedidos-frontend-a-backend.md
-- Cierra la limitación declarada del rate limit de las dos rutas públicas
--   del módulo legal (POST /legal/arrepentimiento y POST /legal/contacto):
--   el contador vivía en la memoria del proceso, así que con varias
--   réplicas o en serverless no limitaba nada. Postgres es el único
--   estado compartido que ya existe.
-- Ventana fija, no deslizante: la deslizante necesita una fila por hit y
--   un count con rango, y ese count no es atómico contra el insert. La
--   ventana fija se resuelve con un solo INSERT ... ON CONFLICT DO UPDATE
--   ... RETURNING hits, que sí lo es porque el DO UPDATE toma el lock de
--   la fila. El costo es el borde de ventana (hasta 2x el límite a
--   caballo de dos ventanas), aceptable para frenar abuso en un
--   formulario público.
-- Reglas: aditiva, sin tocar objetos existentes. RLS habilitada y sin
--   policies: es una tabla de rol de servidor, nadie más la lee ni la
--   escribe.
-- Rollback:
--   DROP TABLE public.rate_limit_counters;
-- ============================================================

-- ============================================================
-- 1. TABLA: rate_limit_counters
--    La PK compuesta (clave, ventana_inicio) es lo que hace atómico al
--    upsert: sin ella el ON CONFLICT no tiene sobre qué resolver.
--    ventana_inicio se calcula en la aplicación (floor(now / ventana) *
--    ventana) para que dos réplicas con relojes distintos caigan igual
--    en el mismo bucket, y para que el test pueda inyectar el now.
--    No hay FK a usuarios: la clave es una IP de una ruta pública, que
--    por definición puede no tener sesión.
-- ============================================================

CREATE TABLE rate_limit_counters (
  clave TEXT NOT NULL,
  ventana_inicio TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (clave, ventana_inicio)
);

-- ============================================================
-- 2. Índice de limpieza
--    El barrido de ventanas vencidas filtra solo por ventana_inicio; la
--    PK arranca por clave, así que no le sirve.
-- ============================================================

CREATE INDEX idx_rate_limit_counters_ventana
  ON rate_limit_counters (ventana_inicio);

-- ============================================================
-- 3. RLS: sin policies para anon/authenticated
-- ============================================================

ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. GRANTs explícitos
--    DELETE incluido: la limpieza de ventanas vencidas la hace el mismo
--    rol de servidor que cuenta los hits.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_counters
  TO service_role, postgres;
