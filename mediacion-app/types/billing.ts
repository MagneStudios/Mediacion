/**
 * Domain types for R-09 (facturación ARCA) + the minimal subscription
 * concept it needs — mirrors `mediacion.dbml`'s `suscripciones`, `pagos`,
 * and `facturas` tables exactly, the same convention `types/plan.ts` and
 * `types/case.ts` already follow.
 */

/**
 * Matches `estado_suscripcion` exactly.
 *
 * `pausada` arrived with the monetización migration
 * (`20260821120000_monetizacion_fase1.sql`, the spec's `paused`) and this type
 * had not caught up — `db-types` has it, BE's `Suscripcion["estado"]` derives
 * from `db-types`, and `GET /suscripciones/vigente` returns that column
 * verbatim, so a paused subscription could already reach the app as a value
 * the front did not know existed.
 */
export type EstadoSuscripcion =
  | 'activa'
  | 'cancelada'
  | 'vencida'
  | 'pendiente_pago'
  | 'pausada';

/** Matches `estado_pago` exactly. */
export type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado';

/** `facturas.estado` is free `text` on the real table (not an enum) — this mirrors the three documented values (R-09 decisiones doc). */
export type EstadoFactura = 'pendiente' | 'emitida' | 'fallida';

export type MockSubscription = {
  id: string;
  planId: string;
  estado: EstadoSuscripcion;
  fechaInicio: string | null;
  fechaFin: string | null;
};

export type MockPayment = {
  id: string;
  suscripcionId: string;
  estado: EstadoPago;
  monto: number;
  createdAt: string;
};

export type MockInvoice = {
  id: string;
  pagoId: string;
  /** Null until ARCA credentials exist (R-09 pendiente no-bloqueante) — never fabricated. */
  numero: string | null;
  cae: string | null;
  /** Null in this mock — there is no real PDF anywhere in this phase; see BillingReceiptScreen. */
  urlPdf: string | null;
  neto: number;
  iva: number;
  impuestos: number;
  total: number;
  estado: EstadoFactura;
  createdAt: string;
};

/**
 * Checkout-time breakdown (R-09: "importes discriminados"). Not a backend
 * row — derived from a plan's `precio` (net) and `configuracion.impuestos`
 * (see `mocks/tax-config.ts`) by `utils/compute-tax-breakdown.ts`, the same
 * calculation an eventual `facturas` row would persist.
 */
export type TaxBreakdown = {
  neto: number;
  iva: number;
  otrosImpuestos: number;
  total: number;
};
