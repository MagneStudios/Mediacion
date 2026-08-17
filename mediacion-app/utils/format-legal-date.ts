/**
 * Formats a legal timestamp as the calendar day it refers to.
 *
 * Shared by every surface that shows a `validFrom`: the "última actualización"
 * line of a published document and the "rige desde" line of the in-product
 * notice banner. Both must read the same date for the same version — a page
 * saying one day and a banner saying the next is the kind of inconsistency the
 * whole versioning flow exists to avoid.
 *
 * Returns `''` for an unusable value. BE types `valid_from` as nullable
 * because `normalizeTimestamp` can return null, and a legal page claiming it
 * was last updated in 1970 discredits the whole document.
 */
export function formatLegalDate(iso: string | null, language: string): string {
  if (!iso) {
    return '';
  }
  const locale = language === 'en' ? 'en-US' : 'es-AR';
  try {
    // UTC on purpose: `valid_from` marks the calendar day a version takes
    // effect. Formatted in local time, a midnight-UTC timestamp would show the
    // previous day anywhere west of Greenwich.
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
