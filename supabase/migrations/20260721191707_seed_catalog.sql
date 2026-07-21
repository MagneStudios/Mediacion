-- ============================================================
-- Proyecto Mediación — Migration 007: Seed Catalog
-- Fecha: 2026-07-20
-- RN/CA: RN-15 (planes), RF-IA-005 (config IA), RF-CFG
-- Rollback: TRUNCATE planes, configuracion;
-- Nota: Los precios y límites son PLACEHOLDERS.
--        Se actualizan cuando el cliente defina valores finales.
--        -1 en límites = ilimitado.
-- ============================================================

-- ============================================================
-- PLANES (RN-15) — precios y límites a confirmar
-- ============================================================

INSERT INTO planes (nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio)
VALUES
  ('base',    3,   2,   5,    0.00),
  ('simple',  10,  5,  15,    9.99),
  ('plus',   -1,  -1,  -1,   19.99),
  ('estudio', 50,  20,  50,   49.99);

-- ============================================================
-- CONFIGURACIÓN DEL SISTEMA (RF-IA-005, RF-CFG)
-- ============================================================

INSERT INTO configuracion (clave, valor, descripcion)
VALUES
  ('ia_modelo',      '"openai/gpt-4"',          'Modelo de IA por defecto para generación de propuestas'),
  ('ia_temperature', '0.7',                      'Temperatura del modelo de IA (0.0 - 2.0)'),
  ('ia_max_tokens',  '2000',                     'Máximo de tokens por respuesta de IA'),
  ('docusign_webhook_secret', '""',              'Secret para validar webhooks de DocuSign (EMPTY en dev)'),
  ('mp_webhook_secret',       '""',              'Secret para validar webhooks de Mercado Pago (EMPTY en dev)');