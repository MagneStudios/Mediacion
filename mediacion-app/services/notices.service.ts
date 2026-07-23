import { buildInitialNotices } from '../mocks/notices';
import type { AppNotice, NoticeFilter, NoticeListItem } from '../types/notice';
import { casesService } from './cases.service';
import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * Replaceable service boundary for the Avisos (notice center) feature.
 *
 * PRIVACY / SCOPE BOUNDARY: this file never imports positionsService,
 * negotiation/agreements/signatures internal stores, or profile state — the
 * only cross-feature dependency is `casesService.getCaseTitle()`, a public
 * read accessor (see cases.service.ts), used solely to resolve a safe
 * display title for a notice's `caseId`. No mutation ever touches any
 * other feature's store.
 */
export type NoticesService = {
  listNotices(filter?: NoticeFilter): Promise<NoticeListItem[]>;
  getUnreadCount(): Promise<number>;
  markNoticeRead(noticeId: string): Promise<AppNotice>;
  markAllNoticesRead(): Promise<AppNotice[]>;
};

/** In-memory only — cleared on app restart, never written to disk, never logged. */
const mockNotices: AppNotice[] = buildInitialNotices();

const failures = createFailureController<'markNoticeRead' | 'markAllNoticesRead'>();

export function __mockForceNoticesFailure(operation: 'markNoticeRead' | 'markAllNoticesRead'): void {
  failures.force(operation);
}

/**
 * Tiny focused external store for the live tab badge — no dependency, no
 * Context/Provider. Listeners are notified only from this file's own two
 * mutations below, so the badge can never go stale regardless of which
 * screen triggered the change.
 */
type Listener = () => void;
let unreadListeners: Listener[] = [];
function notifyUnreadListeners(): void {
  unreadListeners.forEach((listener) => listener());
}
export function subscribeToUnreadCount(listener: Listener): () => void {
  unreadListeners.push(listener);
  return () => {
    unreadListeners = unreadListeners.filter((existing) => existing !== listener);
  };
}
/**
 * Synchronous snapshot for useSyncExternalStore — reads the same
 * `mockNotices` array as every async method below, so it's always
 * consistent with them. Also used as the getServerSnapshot (see
 * useUnreadNotices) since it's already deterministic: the array is freshly
 * seeded, identically, on both server and client, with no persisted state
 * to diverge.
 */
export function getUnreadCountSnapshot(): number {
  return mockNotices.filter((notice) => !notice.read).length;
}

async function resolveCaseTitle(caseId: string | undefined): Promise<string | undefined> {
  if (!caseId) return undefined;
  const title = await casesService.getCaseTitle(caseId);
  return title ?? undefined;
}

async function toListItem(notice: AppNotice): Promise<NoticeListItem> {
  const caseTitle = await resolveCaseTitle(notice.caseId);
  return { ...notice, caseTitle };
}

export function createMockNoticesService(): NoticesService {
  return {
    async listNotices(filter = 'all') {
      const source = filter === 'unread' ? mockNotices.filter((notice) => !notice.read) : mockNotices;
      const sorted = [...source].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const items = await Promise.all(sorted.map(toListItem));
      return delay(items, 500);
    },

    async getUnreadCount() {
      return delay(getUnreadCountSnapshot(), 200);
    },

    async markNoticeRead(noticeId) {
      if (failures.consume('markNoticeRead')) {
        return rejectAfter('mock_mark_notice_read_failed', 400);
      }
      const index = mockNotices.findIndex((notice) => notice.id === noticeId);
      if (index === -1) {
        return rejectAfter('notice_not_found', 200);
      }
      if (mockNotices[index].read) {
        // Idempotent: already read — no mutation, no listener notification.
        return delay({ ...mockNotices[index] }, 150);
      }

      const updated: AppNotice = { ...mockNotices[index], read: true };
      const committed = await delay(updated, 300);
      // Only mutate after the mock "request" resolves — a forced failure
      // above never leaves the notice partially updated.
      mockNotices[index] = committed;
      notifyUnreadListeners();
      return { ...committed };
    },

    async markAllNoticesRead() {
      if (failures.consume('markAllNoticesRead')) {
        return rejectAfter('mock_mark_all_notices_read_failed', 500);
      }

      const next = mockNotices.map((notice) => (notice.read ? notice : { ...notice, read: true }));
      const committed = await delay(next, 500);
      committed.forEach((notice, index) => {
        mockNotices[index] = notice;
      });
      notifyUnreadListeners();
      return [...mockNotices];
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
export const noticesService: NoticesService = createMockNoticesService();
