-- ============================================================
-- Proyecto Mediación — Migration: planes.moneda (punto #24)
-- Fecha: 2026-08-23
-- Origen: docs/pedidos-frontend-a-backend.md §7 — el front hardcodeaba
--         'USD' mientras el cobro real ya era en pesos.
-- ============================================================
-- EL PROBLEMA
--
-- El punto #24 del instructivo ("precios en pesos, finales, con
-- impuestos incluidos") no se cumplía y el esquema era la raíz: no
-- había columna de moneda en ninguna parte, así que el front la
-- inventaba (currency: 'USD' hardcodeado en format-plan-limit.ts)
-- mientras el backend ya cobraba en ARS (defaultCurrencyId = "ARS"
-- en http-mercado-pago-client.ts, la preference de Mercado Pago).
--
-- Esta columna hace de la moneda un DATO: viaja por GET /planes al
-- front y a items[0].currency_id de la preference de MP, y ninguna
-- de las dos puntas vuelve a hardcodearla.
-- ============================================================
-- LA DECISIÓN (y lo que queda abierto)
--
-- Default 'ARS' porque es lo que Mercado Pago cobra hoy: la columna
-- registra la moneda del cobro real, no una aspiración. El CHECK
-- admite solo 'ARS' a propósito — vender en otra moneda es una
-- decisión de Producto/legales que no está tomada; el día que se
-- tome, se amplía el CHECK con otra migración.
--
-- Los VALORES sembrados (9.99 / 19.99 / 25.00) NO se tocan: parecen
-- price points de dólar y releerlos como pesos es una decisión de
-- Producto que sigue abierta (pregunta 1 de §7 del doc de pedidos;
-- RN-15 ya decía "precios a confirmar").
-- ============================================================

-- El CHECK va nombrado (planes_moneda_check) para poder verificar su
-- existencia en pg_constraint y ampliarlo/dropearlo por nombre el día que
-- se admita otra moneda.
ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'ARS'
  CONSTRAINT planes_moneda_check CHECK (moneda IN ('ARS'));

-- Caso columna preexistente: si `moneda` ya existía (creada a mano o por
-- otra rama), el ADD COLUMN IF NOT EXISTS de arriba se saltea ENTERO —
-- default y CHECK inline incluidos. Estas dos sentencias cubren ese caso y
-- son no-op cuando la columna la creó esta misma migración.
ALTER TABLE planes
  ALTER COLUMN moneda SET DEFAULT 'ARS';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planes_moneda_check'
      AND conrelid = 'planes'::regclass
  ) THEN
    ALTER TABLE planes
      ADD CONSTRAINT planes_moneda_check CHECK (moneda IN ('ARS'));
  END IF;
END $$;

-- Rollback:
--   ALTER TABLE planes DROP COLUMN IF EXISTS moneda;
--   (dropear la columna arrastra planes_moneda_check y el default)
