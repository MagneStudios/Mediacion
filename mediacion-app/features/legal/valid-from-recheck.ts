/**
 * `setTimeout` takes a 32-bit signed delay: anything past ~24.8 days overflows
 * and fires immediately, and a legal version can be scheduled months out. So
 * the wait is clamped to 24 hours and re-armed until the target is actually
 * reached — never an unclamped timer, never a free-running `setInterval`.
 */
export const maxRecheckDelayMs = 24 * 60 * 60 * 1000;

/**
 * Floor for every armed delay. A `validFrom` the read keeps returning as
 * "scheduled" while this clock already considers it past (a client clock
 * running ahead of the server's) would otherwise arm at delay 0 and reload in
 * a tight loop; the floor turns that pathological case into one re-check
 * every 30 seconds at worst.
 */
export const minRecheckDelayMs = 30 * 1000;

/**
 * Arms a timer that calls `onDue` once `validFromMs` is no longer in the
 * future, re-arming itself (clamped) while it still is. Both legal surfaces
 * share it: `VersionNoticeBanner` reloads so a version that entered into force
 * stops being announced, and `ReacceptanceGate` re-checks so a substantial
 * version starts blocking — with the app open the whole time (a long-lived
 * web tab never remounts either component).
 *
 * A non-finite `validFromMs` (a `Date.parse` of a null or malformed date)
 * arms nothing: `setTimeout(NaN)` silently means delay 0, which would fire an
 * immediate — and then looping — re-check over a date that does not exist.
 *
 * Returns the cancel function, meant for the cleanup of the `useEffect` that
 * armed it (precedente `InvitationResultCard`).
 */
export function scheduleValidFromRecheck(
  validFromMs: number,
  onDue: () => void,
): () => void {
  if (!Number.isFinite(validFromMs)) {
    return () => {};
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    const delayMs = Math.min(
      Math.max(validFromMs - Date.now(), minRecheckDelayMs),
      maxRecheckDelayMs,
    );
    timer = setTimeout(() => {
      if (Date.now() < validFromMs) {
        arm();
        return;
      }
      onDue();
    }, delayMs);
  };
  arm();
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
  };
}
