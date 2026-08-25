import i18n from '../../i18n';
import { formatPlanLimit, formatPlanPrice } from '../format-plan-limit';

describe('formatPlanLimit', () => {
  it('renders the unlimited label for both sentinel conventions (null and -1)', () => {
    expect(formatPlanLimit(null)).toBe(i18n.t('admin.planes.limit.unlimited'));
    expect(formatPlanLimit(-1)).toBe(i18n.t('admin.planes.limit.unlimited'));
  });

  it('renders a concrete limit as-is', () => {
    expect(formatPlanLimit(5)).toBe('5');
    expect(formatPlanLimit(0)).toBe('0');
  });
});

describe('formatPlanPrice', () => {
  // Punto #24: the currency is DATA (planes.moneda / invoice.moneda), never a
  // hardcoded literal. The jest runtime language is 'en' (jest-expo mocks the
  // device locale), so prices format with en-US rules; "ARS<nbsp>25.00" was
  // verified empirically against this runtime's Intl, not assumed.
  it("formats in the plan's own currency, taken from the data", () => {
    expect(formatPlanPrice(25, 'ARS')).toBe('ARS\u00a025.00');
    expect(formatPlanPrice(12.09, 'ARS')).toBe('ARS\u00a012.09');
  });

  it('does not hardcode a currency — a different moneda changes the output', () => {
    expect(formatPlanPrice(25, 'USD')).toBe('$25.00');
    expect(formatPlanPrice(25, 'USD')).not.toBe(formatPlanPrice(25, 'ARS'));
  });

  it('a free plan (precio 0) formats as a zero amount, never NaN', () => {
    const formatted = formatPlanPrice(0, 'ARS');
    expect(formatted).toBe('ARS\u00a00.00');
    expect(formatted).not.toContain('NaN');
  });

  it('falls back to a code-prefixed fixed-decimal string when Intl rejects the currency — never a bare $', () => {
    expect(formatPlanPrice(25, 'not-a-currency')).toBe('not-a-currency 25.00');
  });
});
