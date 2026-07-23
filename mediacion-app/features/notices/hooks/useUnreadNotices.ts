import { useSyncExternalStore } from 'react';

import { getUnreadCountSnapshot, subscribeToUnreadCount } from '../../../services/notices.service';

/**
 * Live unread count for the Avisos tab badge — no dependency, no
 * Context/Provider. Subscribes directly to notices.service.ts's tiny
 * focused external store, so the badge updates after mark-one/mark-all
 * regardless of which screen triggered it. `getServerSnapshot` reuses the
 * same synchronous snapshot function as the client: the underlying array is
 * freshly seeded, identically, on both server (static export) and client
 * (fresh session) — there is no persisted state to diverge, so server and
 * client always agree at hydration.
 */
export function useUnreadNotices(): number {
  return useSyncExternalStore(subscribeToUnreadCount, getUnreadCountSnapshot, getUnreadCountSnapshot);
}
