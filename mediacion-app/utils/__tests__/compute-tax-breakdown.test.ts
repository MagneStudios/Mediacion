import { computeTaxBreakdown } from '../compute-tax-breakdown';

describe('computeTaxBreakdown', () => {
  it('applies the seeded AR 21% IVA to the net price', () => {
    const breakdown = computeTaxBreakdown(25);
    expect(breakdown).toEqual({ neto: 25, iva: 5.25, otrosImpuestos: 0, total: 30.25 });
  });

  it('total always equals neto + iva + otrosImpuestos', () => {
    const breakdown = computeTaxBreakdown(19.99);
    expect(breakdown.total).toBeCloseTo(breakdown.neto + breakdown.iva + breakdown.otrosImpuestos, 2);
  });

  it('a free plan (precio 0) has a zero breakdown, not a crash', () => {
    expect(computeTaxBreakdown(0)).toEqual({ neto: 0, iva: 0, otrosImpuestos: 0, total: 0 });
  });

  it('falls back to the default country config for an unconfigured country', () => {
    expect(computeTaxBreakdown(25, 'ZZ')).toEqual(computeTaxBreakdown(25, 'AR'));
  });

  it('rounds each line to cents', () => {
    const breakdown = computeTaxBreakdown(9.99);
    expect(breakdown.iva).toBe(2.1); // 9.99 * 0.21 = 2.0979 → 2.10
    expect(breakdown.total).toBe(12.09);
  });
});
