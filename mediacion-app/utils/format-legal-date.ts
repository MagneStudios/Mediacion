/**
 * Two formatters, same shape, different time zone — and the difference is the
 * whole point of this file.
 *
 * A timestamp coming out of the API is one of two things, and they are not
 * rendered the same way:
 *
 * - **A declared calendar day.** `valid_from` says "this version applies from
 *   the 1st of September". It is stored at midnight UTC, and the day is the
 *   fact; the instant is an artefact. → `formatLegalDate`, UTC.
 * - **The moment something happened.** `fecha_fin` says "the baja was
 *   registered at this instant". The instant is the fact, and the day the user
 *   should read is the day it was for *them*. → `formatEventDate`, local.
 *
 * Using the UTC one for an instant is a real bug, not a nuance: a user in
 * Buenos Aires who cancels at 22:55 on the 17th gets told they cancelled on
 * the 18th. Verified in the browser, which is where it surfaced — a unit test
 * comparing against the same formatter cannot see it.
 *
 * Both return `''` for an unusable value. BE types these columns as nullable
 * because `normalizeTimestamp` can return null, and a legal page claiming it
 * was last updated in 1970 discredits the whole document.
 */

function formatDay(iso: string | null, language: string, timeZone?: string): string {
  if (!iso) {
    return '';
  }
  const locale = language === 'en' ? 'en-US' : 'es-AR';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * The calendar day a legal document declares.
 *
 * Shared by every surface that shows a `validFrom`: the "última actualización"
 * line of a published document and the "rige desde" line of the in-product
 * notice banner. Both must read the same date for the same version — a page
 * saying one day and a banner saying the next is the kind of inconsistency the
 * whole versioning flow exists to avoid.
 *
 * UTC on purpose: formatted in local time, a midnight-UTC timestamp would show
 * the previous day anywhere west of Greenwich.
 */
export function formatLegalDate(iso: string | null, language: string): string {
  return formatDay(iso, language, 'UTC');
}

/**
 * The day an event was recorded, read in the viewer's own time zone.
 *
 * For `fechaFin` — when a baja was registered — the user's answer to "when did
 * I cancel?" is their own calendar, not Greenwich's.
 */
export function formatEventDate(iso: string | null, language: string): string {
  return formatDay(iso, language, undefined);
}
