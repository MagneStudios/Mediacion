/**
 * The live unread count behind the Avisos tab badge.
 *
 * This used to be module state inside notices.service.ts, computed synchronously
 * from the mock array. A real backend cannot be read synchronously, so the count
 * now lives here as a cached number that whichever implementation is active
 * pushes into after every read or mutation. `useUnreadNotices` still consumes it
 * through `useSyncExternalStore`, unchanged.
 *
 * The cache starts at 0 rather than at some "unknown" sentinel: a badge that is
 * briefly absent is honest, whereas a badge showing a guessed number is not.
 */
type Listener = () => void;

let listeners: Listener[] = [];
let unreadCount = 0;

export function subscribeToUnreadCount(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((existing) => existing !== listener);
  };
}

/**
 * Synchronous snapshot for useSyncExternalStore. Also serves as the
 * getServerSnapshot: the cache seeds to the same 0 on both server (static
 * export) and client, so hydration can never disagree.
 */
export function getUnreadCountSnapshot(): number {
  return unreadCount;
}

/** No-ops when the count is unchanged, so an unrelated re-read never re-renders the badge. */
export function setUnreadCount(next: number): void {
  const safe = Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
  if (safe === unreadCount) {
    return;
  }
  unreadCount = safe;
  listeners.forEach((listener) => listener());
}

/** Test seam — the store is module state and would otherwise leak across suites. */
export function __resetUnreadCount(): void {
  unreadCount = 0;
  listeners = [];
}
