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

/** Locale-aware price, e.g. "$25.00" — same Intl.NumberFormat pattern as formatAgreementDate's Intl.DateTimeFormat use. */
export function formatPlanPrice(precio: number): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(precio);
  } catch {
    return `$${precio.toFixed(2)}`;
  }
}
