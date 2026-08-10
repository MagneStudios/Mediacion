/**
 * Mirrors the real seed row for `configuracion.impuestos` (R-09):
 * `{"AR":{"iva":21,"otros_impuestos":0}}` (`supabase/migrations/
 * 20260810120000_cambios_reunion_07_08.sql`). Parametrizable by country per
 * the reunión decision — this mock only ever has an `AR` entry, since
 * there's no country selection anywhere in this app yet.
 */
export const mockTaxConfig: Record<string, { ivaPercent: number; otrosImpuestosPercent: number }> = {
  AR: { ivaPercent: 21, otrosImpuestosPercent: 0 },
};

export const defaultTaxCountry = 'AR';
