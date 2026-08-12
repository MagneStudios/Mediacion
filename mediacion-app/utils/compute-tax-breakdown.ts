import { defaultTaxCountry, mockTaxConfig } from '../mocks/tax-config';
import type { TaxBreakdown } from '../types/billing';

/**
 * R-09: turns a plan's net price into the discriminated checkout breakdown
 * (neto + IVA + otros impuestos + total) the reunión decided every checkout
 * must show. Rounds each line to cents independently, then sums the rounded
 * lines for `total` — matching how a real invoice's stored columns would
 * add up, rather than rounding a single float division at the end.
 */
export function computeTaxBreakdown(precioNeto: number, country: string = defaultTaxCountry): TaxBreakdown {
  const config = mockTaxConfig[country] ?? mockTaxConfig[defaultTaxCountry];
  const neto = roundToCents(precioNeto);
  const iva = roundToCents((precioNeto * config.ivaPercent) / 100);
  const otrosImpuestos = roundToCents((precioNeto * config.otrosImpuestosPercent) / 100);
  return {
    neto,
    iva,
    otrosImpuestos,
    total: roundToCents(neto + iva + otrosImpuestos),
  };
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
