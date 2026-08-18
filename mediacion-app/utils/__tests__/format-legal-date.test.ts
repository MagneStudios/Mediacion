import { formatEventDate, formatLegalDate } from '../format-legal-date';

/** Two digits, the way both formatters render a day. */
function day(value: number): string {
  return String(value).padStart(2, '0');
}

describe('formatEventDate', () => {
  it('reads an instant in the local calendar, while its sibling reads UTC', () => {
    // The bug this pins: the baja notice told a user in Buenos Aires who
    // cancelled at 22:55 on the 17th that they had cancelled on the 18th,
    // because `fechaFin` was being rendered with the UTC formatter meant for
    // a document's `validFrom`. It surfaced in the browser — a unit test
    // comparing against that same formatter could not see it.
    //
    // The instant is chosen so its local calendar day differs from its UTC one
    // whichever side of Greenwich this machine sits on. `process.env.TZ` is
    // deliberately not touched: changing it at runtime does not affect `Intl`
    // in this jest environment, so a test that pinned a zone that way would be
    // asserting nothing. On a machine genuinely running in UTC no such instant
    // exists and the two formatters legitimately agree.
    const westOfGreenwich = new Date('2026-08-18T00:30:00.000Z').getTimezoneOffset() > 0;
    const instant = westOfGreenwich ? '2026-08-18T00:30:00.000Z' : '2026-08-18T23:30:00.000Z';
    const moment = new Date(instant);

    expect(formatEventDate(instant, 'es-AR')).toContain(`${day(moment.getDate())} de`);
    expect(formatLegalDate(instant, 'es-AR')).toContain(`${day(moment.getUTCDate())} de`);
  });

  it('returns an empty string for a missing value, like its sibling', () => {
    expect(formatEventDate(null, 'es-AR')).toBe('');
  });
});

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
