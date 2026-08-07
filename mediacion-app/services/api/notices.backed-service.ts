import type { AppNotice, NoticeFilter, NoticeListItem } from '@/types/notice';

import { setUnreadCount } from '../notices-unread-store';
import type { NoticesService } from '../notices.service';
import type { ApiNoticesService } from './notices.api-service';

/** Injected rather than imported so this module stays testable without the cases stack. */
export type CaseTitleResolver = (caseId: string) => Promise<string | null>;

/**
 * Resolves one title per distinct caso, not one per notice.
 *
 * The mock resolved titles inside a per-item `Promise.all`, which is an N+1 the
 * moment the list is real: ten notices on the same caso meant ten identical
 * requests. Distinct ids are still fetched concurrently.
 *
 * A title that fails to resolve becomes `undefined`, never a thrown error — the
 * list renders without the case line, which is exactly what the UI already does
 * for a notice whose caso it cannot see.
 */
async function resolveTitles(
  notices: AppNotice[],
  getCaseTitle: CaseTitleResolver,
): Promise<Map<string, string>> {
  const ids = [...new Set(notices.map((notice) => notice.caseId).filter((id): id is string => !!id))];
  const resolved = await Promise.all(
    ids.map(async (id): Promise<[string, string] | null> => {
      try {
        const title = await getCaseTitle(id);
        return title === null ? null : [id, title];
      } catch {
        return null;
      }
    }),
  );
  return new Map(resolved.filter((entry): entry is [string, string] => entry !== null));
}

/**
 * Presents the real API under the contract the Avisos screens already consume.
 *
 * Two gaps are bridged honestly rather than faked:
 *
 * - The `unread` filter is applied client-side. `GET /notificaciones` takes no
 *   filter parameter, so the alternative would be inventing a query the server
 *   ignores.
 *
 * - `markAllNoticesRead` must return the resulting notices, but
 *   `POST /notificaciones/leidas` answers with only a count. The list is
 *   re-read instead of being patched locally, so what the screen renders is
 *   what the server actually holds.
 */
export function createBackedNoticesService(
  api: ApiNoticesService,
  getCaseTitle: CaseTitleResolver,
): NoticesService {
  async function listWithTitles(filter: NoticeFilter): Promise<NoticeListItem[]> {
    const all = await api.listNotices();
    const visible = filter === 'unread' ? all.filter((notice) => !notice.read) : all;
    const sorted = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const titles = await resolveTitles(sorted, getCaseTitle);
    // Keeping the badge honest on every read costs nothing: the count is
    // already derivable from the full list we just fetched.
    setUnreadCount(all.filter((notice) => !notice.read).length);
    return sorted.map((notice) => ({
      ...notice,
      ...(notice.caseId && titles.has(notice.caseId)
        ? { caseTitle: titles.get(notice.caseId) }
        : {}),
    }));
  }

  async function refreshUnread(): Promise<number> {
    const unread = await api.getUnreadCount();
    setUnreadCount(unread);
    return unread;
  }

  return {
    listNotices(filter: NoticeFilter = 'all'): Promise<NoticeListItem[]> {
      return listWithTitles(filter);
    },

    getUnreadCount(): Promise<number> {
      return refreshUnread();
    },

    async markNoticeRead(noticeId: string): Promise<AppNotice> {
      const updated = await api.markNoticeRead(noticeId);
      // Re-read rather than decrement: the PATCH is idempotent and its response
      // does not say whether this call is what flipped the notice, so a local
      // decrement would drift on a double tap.
      await refreshUnread();
      return updated;
    },

    async markAllNoticesRead(): Promise<AppNotice[]> {
      const unread = await api.markAllNoticesRead();
      setUnreadCount(unread);
      return api.listNotices();
    },
  };
}
