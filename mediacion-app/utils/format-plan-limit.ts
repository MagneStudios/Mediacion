import i18n from '../i18n';

/**
 * Renders a plan limit column for display, handling both sentinel
 * conventions the schema uses for "unlimited" (see types/plan.ts):
 * `null` (limiteCasos, post-R-10) and `-1` (limiteCarpetas/limiteIteracionesIa).
 */
export function formatPlanLimit(value: number | null): string {
  if (value === null || value === -1) {
    return i18n.t('admin.planes.limit.unlimited');
  }
  return String(value);
}

/**
 * Locale-aware price in the plan's own currency (punto #24) — `moneda`
 * always comes from the data (`Plan.moneda` / `MockInvoice.moneda`), never
 * from a literal in a component. Same Intl.NumberFormat pattern as
 * formatAgreementDate's Intl.DateTimeFormat use.
 */
export function formatPlanPrice(precio: number, moneda: string): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: moneda }).format(precio);
  } catch {
    // The fallback keeps the currency code visible: a bare `$` would revive
    // the exact ambiguity (which currency is this?) punto #24 exists to kill.
    return `${moneda} ${precio.toFixed(2)}`;
  }
}
