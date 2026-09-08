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

/**
 * One countable of the plan, as `GET /suscripciones/uso` reports it.
 *
 * `limit: null` means **unlimited**, the same convention `Plan`'s two period
 * quotas use — and the reason nothing here computes a percentage: a share of an
 * unbounded total is not a number, so the screen has to branch instead of
 * dividing.
 */
export type UsageCounter = {
  used: number;
  limit: number | null;
};

/**
 * What the caller has consumed of their plan this billing period
 * (`GET /suscripciones/uso`, ficha §11 of `docs/fichas-legal-backend.md`, the
 * shape frozen in `docs/plan-frontend-monetizacion.md` §4.1).
 *
 * This is the *flow* side of the model — what was created since the period
 * opened — as opposed to the *stock* limits on `Plan` (`limiteCasos` and
 * friends), which count what may exist at once. Both are live and neither has
 * been retired.
 */
export type SubscriptionUsage = {
  /**
   * The billing window. BE types these non-nullable and fills them from the
   * `suscripciones` row, anchoring a 30-day window on `fecha_inicio` for rows
   * that predate the feature. They are still parsed rather than trusted: this
   * is the one field the screen turns into a date on screen, and an
   * unparseable instant would render as "Invalid Date" instead of simply not
   * being shown.
   */
  periodStart: string | null;
  periodEnd: string | null;
  negotiations: UsageCounter;
  /**
   * `null` for anyone who is not the titular of an estudio — **not a counter at
   * zero**. "This does not apply to you" and "you have used none of your 20"
   * are different sentences, and only one of them should be on screen.
   */
  clients: UsageCounter | null;
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
  /** Punto #24: snapshot of the plan's `moneda` at subscribe time — the receipt formats with the data, never a literal. */
  moneda: string;
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
