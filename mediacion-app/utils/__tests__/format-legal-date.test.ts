import { formatLegalDate } from '../format-legal-date';

describe('formatLegalDate', () => {
  it('formats the calendar day in Spanish by default', () => {
    expect(formatLegalDate('2026-09-01T00:00:00.000Z', 'es-AR')).toBe(
      '01 de septiembre de 2026',
    );
  });

  it('formats in English when that is the active language', () => {
    expect(formatLegalDate('2026-09-01T00:00:00.000Z', 'en')).toBe('September 01, 2026');
  });

  it('reads a midnight timestamp as its UTC day, not the previous one', () => {
    // Anywhere west of Greenwich, local formatting of this value would show
    // 31 August — and a legal date that is off by one day is a wrong date.
    expect(formatLegalDate('2026-09-01T00:00:00.000Z', 'es-AR')).toContain('septiembre');
  });

  it('returns an empty string for a missing value instead of a 1970 date', () => {
    expect(formatLegalDate(null, 'es-AR')).toBe('');
  });

  it('falls back to the raw value when it cannot be parsed', () => {
    expect(formatLegalDate('no es una fecha', 'es-AR')).toBe('no es una fecha');
  });
});
