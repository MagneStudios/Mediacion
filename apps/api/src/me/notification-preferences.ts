/**
 * The seven notification toggles, stored as JSONB on `usuarios`.
 *
 * Kept as a pure module with no I/O so the parsing rules are testable on their
 * own: the column is JSONB, which means anything at all can be in there — an
 * older shape, a hand-edited row, `null` — and the API must never hand a caller
 * a half-populated object it then treats as authoritative.
 */

export const notificationPreferenceKeys = [
  "caseUpdates",
  "proposalReady",
  "responseReceived",
  "signatureReady",
  "agreementCompleted",
  "mediatorAvailability",
  "productUpdates",
] as const;

export type NotificationPreferenceKey =
  (typeof notificationPreferenceKeys)[number];

export type NotificationPreferences = Record<
  NotificationPreferenceKey,
  boolean
>;

export type UpdateNotificationPreferencesDto = Partial<NotificationPreferences>;

/**
 * Opted in across the board. This matches what the system does today — every
 * notification is sent to everyone — so reading a row written before the column
 * existed reports the behaviour that row actually had, not a silent opt-out.
 */
export function defaultNotificationPreferences(): NotificationPreferences {
  return notificationPreferenceKeys.reduce((accumulator, key) => {
    accumulator[key] = true;
    return accumulator;
  }, {} as NotificationPreferences);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads whatever is in the column into a complete, fully typed object.
 *
 * Unknown keys are dropped and non-boolean values fall back to the default
 * rather than being coerced: `"false"` coerced to `true` would silently opt a
 * user back in to something they turned off.
 */
export function parseNotificationPreferences(
  stored: unknown,
): NotificationPreferences {
  const defaults = defaultNotificationPreferences();
  if (!isPlainObject(stored)) {
    return defaults;
  }
  return notificationPreferenceKeys.reduce((accumulator, key) => {
    const value = stored[key];
    accumulator[key] = typeof value === "boolean" ? value : defaults[key];
    return accumulator;
  }, {} as NotificationPreferences);
}

/**
 * Narrows a caller-supplied patch to the known keys with boolean values.
 *
 * Everything else is discarded silently rather than rejected: a client sending
 * an extra field it invented should not fail the request, but it must not be
 * able to write arbitrary JSON into the column either.
 */
export function pickNotificationPreferencePatch(
  patch: unknown,
): UpdateNotificationPreferencesDto {
  if (!isPlainObject(patch)) {
    return {};
  }
  const result: UpdateNotificationPreferencesDto = {};
  for (const key of notificationPreferenceKeys) {
    const value = patch[key];
    if (typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}

/** Applies a narrowed patch on top of the stored value, keeping it complete. */
export function mergeNotificationPreferences(
  stored: unknown,
  patch: UpdateNotificationPreferencesDto,
): NotificationPreferences {
  return { ...parseNotificationPreferences(stored), ...patch };
}
