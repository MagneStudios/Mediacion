/**
 * Domain types for the Avisos (notice center) feature.
 *
 * BACKEND ALIGNMENT: the real `notificaciones` table is a delivery LOG only
 * — `canal: 'email'|'push'`, `evento: text` (free text, not an enum), and
 * `estado: 'pendiente'|'enviada'|'fallida'` (a delivery status, never a read
 * receipt). There is no read/unread column anywhere in the schema.
 *
 * Therefore EVERYTHING in this file is frontend-only mock presentation
 * state, not a backend mirror:
 * - NoticeCategory — a closed UI catalog; the real `evento` field is free
 *   text with no enum to mirror.
 * - NoticePriority — invented; no backend severity/priority field exists.
 * - `read: boolean` — invented; there is no backend read/unread state.
 * - NoticeDestination — a frontend-only typed navigation model with no
 *   backend counterpart.
 *
 * A future backend-integration phase would need genuinely new schema (a
 * per-user read-state column, a closed event-type enum) before this feature
 * could be backed by `notificaciones` as-is.
 */

export type NoticeCategory =
  | 'case'
  | 'invitation'
  | 'proposal'
  | 'response'
  | 'round'
  | 'agreement'
  | 'signature'
  | 'mediator'
  | 'deadline'
  | 'institutional'
  | 'system';

/** Frontend-only. Never conveyed by color alone — always paired with a text label in the UI. */
export type NoticePriority = 'normal' | 'important';

/**
 * Only known, supported in-app destinations — never an arbitrary route
 * string built from fixture data. See utils/resolve-notice-destination.ts,
 * the one place these are mapped to real route paths.
 */
export type NoticeDestination =
  | { type: 'case'; caseId: string }
  | { type: 'negotiation'; caseId: string }
  | { type: 'agreement'; caseId: string }
  | { type: 'signature'; caseId: string }
  | { type: 'mediator'; caseId: string }
  | { type: 'activity' }
  | { type: 'none' };

export type NoticeFilter = 'all' | 'unread';

/**
 * Stored/fixture-facing shape. Deliberately holds only `caseId`, never a
 * denormalized case title — see NoticeListItem for the read-time projection
 * that resolves a safe title through the public cases-service accessor.
 * `titleKey`/`bodyKey` + `params` are i18next keys/interpolation values —
 * never raw UI copy, never HTML/markdown, never a route string.
 */
export interface AppNotice {
  id: string;
  category: NoticeCategory;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string | number>;
  createdAt: string;
  read: boolean;
  priority: NoticePriority;
  destination: NoticeDestination;
  caseId?: string;
}

/**
 * What `noticesService.listNotices()` actually returns: an `AppNotice` plus
 * `caseTitle`, resolved at read time via the public cases-service accessor
 * (`casesService.getCaseTitle`) — never a stored/persisted field, and never
 * fetched by a UI component directly (only the service imports
 * casesService). Undefined when the notice has no case, or when the
 * referenced case can't be found — rendered safely with no case line.
 */
export type NoticeListItem = AppNotice & { caseTitle?: string };
