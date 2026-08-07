import { buildInitialNotices } from '../mocks/notices';
import type { AppNotice, NoticeFilter, NoticeListItem, NoticePriority } from '../types/notice';
import { createBackedNoticesService } from './api/notices.backed-service';
import { backend } from './backend-instance';
import { casesService } from './cases.service';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { getUnreadCountSnapshot, setUnreadCount, subscribeToUnreadCount } from './notices-unread-store';

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
 * The tab-badge store moved to notices-unread-store.ts so the API-backed
 * implementation can feed it too — a real backend cannot be read synchronously,
 * which the old "recount the mock array" snapshot assumed. Re-exported here so
 * `useUnreadNotices` keeps importing from the same place.
 */
export { getUnreadCountSnapshot, subscribeToUnreadCount };

/** Recomputes the badge from the mock array. The API-backed path uses the server's count instead. */
function notifyUnreadListeners(): void {
  setUnreadCount(mockNotices.filter((notice) => !notice.read).length);
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

/** Default instance consumed by the feature hooks — the single place where the real API is swapped in. */
export const noticesService: NoticesService = backend
  ? createBackedNoticesService(backend.notices, (caseId) => casesService.getCaseTitle(caseId))
  : createMockNoticesService();

// The mock path seeds the badge from its fixtures, which the old synchronous
// snapshot recomputed on every read. The API-backed path deliberately does not
// seed: its first real count arrives from the server, and a guessed badge in the
// meantime would be worse than none.
if (!backend) {
  notifyUnreadListeners();
}

const MEDIATOR_NOTICE_EVENT_KEYS = [
  'mediator_request_submitted',
  'mediator_request_pending',
  'mediator_assigned',
  'mediator_unavailable',
] as const;
export type MediatorNoticeEventKey = (typeof MEDIATOR_NOTICE_EVENT_KEYS)[number];

const MEDIATOR_NOTICE_COPY: Record<MediatorNoticeEventKey, { titleKey: string; bodyKey: string; priority: NoticePriority }> = {
  mediator_request_submitted: {
    titleKey: 'mediator.notices.requestSubmitted.title',
    bodyKey: 'mediator.notices.requestSubmitted.body',
    priority: 'normal',
  },
  mediator_request_pending: {
    titleKey: 'mediator.notices.requestPending.title',
    bodyKey: 'mediator.notices.requestPending.body',
    priority: 'normal',
  },
  mediator_assigned: {
    titleKey: 'mediator.notices.assigned.title',
    bodyKey: 'mediator.notices.assigned.body',
    priority: 'important',
  },
  mediator_unavailable: {
    titleKey: 'mediator.notices.unavailable.title',
    bodyKey: 'mediator.notices.unavailable.body',
    priority: 'normal',
  },
};

export type StrictMediatorNoticeInput = { caseId: string; eventKey: MediatorNoticeEventKey };

/**
 * Narrow, validated append surface for the mediator feature only — never a
 * generic "create any notice" API. Category is always 'mediator' and
 * destination is always `{ type: 'mediator', caseId }`, both fixed
 * internally — never caller-supplied — so this can't be used to inject an
 * arbitrary notice shape. Validates the event key against the fixed
 * 4-value allow-list, validates the case exists (via
 * casesService.getCaseTitle), and dedupes deterministically on a
 * `caseId + eventKey` id so a retried best-effort call after a mediator
 * mutation never creates a duplicate notice. Returns null (never throws)
 * on any validation failure or on a duplicate — callers treat this as a
 * best-effort side effect that must never roll back an already-committed
 * mediator state.
 */
export async function appendMediatorNotice(input: StrictMediatorNoticeInput): Promise<AppNotice | null> {
  // The API owns the notificaciones table and exposes no create endpoint — only
  // list/read/mark. Writing to the mock array while the rest of the screen reads
  // the server would put a notice on screen that vanishes on the next refresh,
  // so against a real backend this stays the no-op its contract already allows.
  if (backend) return null;
  if (!MEDIATOR_NOTICE_EVENT_KEYS.includes(input.eventKey)) return null;

  const title = await casesService.getCaseTitle(input.caseId);
  if (!title) return null;

  const id = `mediator-notice-${input.caseId}-${input.eventKey}`;
  if (mockNotices.some((notice) => notice.id === id)) return null;

  const copy = MEDIATOR_NOTICE_COPY[input.eventKey];
  const notice: AppNotice = {
    id,
    category: 'mediator',
    titleKey: copy.titleKey,
    bodyKey: copy.bodyKey,
    createdAt: new Date().toISOString(),
    read: false,
    priority: copy.priority,
    destination: { type: 'mediator', caseId: input.caseId },
    caseId: input.caseId,
  };

  const committed = await delay(notice, 200);
  mockNotices.push(committed);
  notifyUnreadListeners();
  return { ...committed };
}

const CASE_NOTICE_EVENT_KEYS = ['invitation_accepted_simulated'] as const;
export type CaseNoticeEventKey = (typeof CASE_NOTICE_EVENT_KEYS)[number];

const CASE_NOTICE_COPY: Record<CaseNoticeEventKey, { titleKey: string; bodyKey: string; priority: NoticePriority }> = {
  invitation_accepted_simulated: {
    titleKey: 'caseDetail.awaitingCounterparty.simulateAcceptance.notice.title',
    bodyKey: 'caseDetail.awaitingCounterparty.simulateAcceptance.notice.body',
    priority: 'normal',
  },
};

export type StrictCaseNoticeInput = { caseId: string; eventKey: CaseNoticeEventKey };

/**
 * Narrow, validated append surface for the case-lifecycle demo actions
 * only (phase 9's simulated invitation acceptance) — never a generic
 * "create any notice" API. Category is always 'invitation' and destination
 * is always `{ type: 'case', caseId }`, both fixed internally — never
 * caller-supplied. Validates the event key against the fixed 1-value
 * allow-list, validates the case exists (via casesService.getCaseTitle),
 * and dedupes deterministically on a `case-notice-${caseId}-${eventKey}`
 * id so a retried best-effort call is a guaranteed no-op. Returns null
 * (never throws) on any validation failure or duplicate.
 */
export async function appendCaseNotice(input: StrictCaseNoticeInput): Promise<AppNotice | null> {
  // Same reason as appendMediatorNotice: no server-side create endpoint exists.
  if (backend) return null;
  if (!CASE_NOTICE_EVENT_KEYS.includes(input.eventKey)) return null;

  const title = await casesService.getCaseTitle(input.caseId);
  if (!title) return null;

  const id = `case-notice-${input.caseId}-${input.eventKey}`;
  if (mockNotices.some((notice) => notice.id === id)) return null;

  const copy = CASE_NOTICE_COPY[input.eventKey];
  const notice: AppNotice = {
    id,
    category: 'invitation',
    titleKey: copy.titleKey,
    bodyKey: copy.bodyKey,
    createdAt: new Date().toISOString(),
    read: false,
    priority: copy.priority,
    destination: { type: 'case', caseId: input.caseId },
    caseId: input.caseId,
  };

  const committed = await delay(notice, 200);
  mockNotices.push(committed);
  notifyUnreadListeners();
  return { ...committed };
}
