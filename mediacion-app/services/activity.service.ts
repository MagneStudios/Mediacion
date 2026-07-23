import { buildInitialActivity } from '../mocks/activity';
import type { ActivityEventKey, ActivityItem, ActivityListItem } from '../types/activity';
import { casesService } from './cases.service';
import { delay } from './mock-utils';

/**
 * Replaceable service boundary for the read-only "Actividad del proceso"
 * timeline.
 *
 * PRIVACY / SCOPE BOUNDARY: this file never imports positionsService or
 * PositionItem. `mockActivity` is immutable after seeding except through
 * `appendMediatorActivity` below — a narrow, validated append surface used
 * only by the mediator feature (phase 8), never a generic "create any
 * activity item" API. The only cross-feature dependency is
 * `casesService.getCaseTitle()`, the same public read accessor
 * notices.service.ts uses, for a safe display title only.
 */
export type ActivityService = {
  listActivity(): Promise<ActivityListItem[]>;
};

/** In-memory only, immutable after seeding except via appendMediatorActivity. */
const mockActivity: ActivityItem[] = buildInitialActivity();

async function resolveCaseTitle(caseId: string | undefined): Promise<string | undefined> {
  if (!caseId) return undefined;
  const title = await casesService.getCaseTitle(caseId);
  return title ?? undefined;
}

async function toListItem(item: ActivityItem): Promise<ActivityListItem> {
  const caseTitle = await resolveCaseTitle(item.caseId);
  return { ...item, caseTitle };
}

export function createMockActivityService(): ActivityService {
  return {
    async listActivity() {
      const sorted = [...mockActivity].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const items = await Promise.all(sorted.map(toListItem));
      return delay(items, 500);
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
export const activityService: ActivityService = createMockActivityService();

const MEDIATOR_ACTIVITY_EVENT_KEYS = ['mediator_requested', 'mediator_assigned', 'accompaniment_started'] as const satisfies readonly ActivityEventKey[];
export type MediatorActivityEventKey = (typeof MEDIATOR_ACTIVITY_EVENT_KEYS)[number];

export type StrictMediatorActivityInput = { caseId: string; eventKey: MediatorActivityEventKey };

/**
 * Narrow, validated append surface for the mediator feature only — never a
 * generic "create any activity item" API. Only the 3 explicitly
 * shared-safe mediator milestones may be appended here (never internal
 * review states, notes, assessments, blame, or recommendations).
 * Destination is always `{ type: 'mediator', caseId }`, fixed internally.
 * Validates the event key against the fixed allow-list and the case exists
 * (via casesService.getCaseTitle), and dedupes deterministically on a
 * `caseId + eventKey` id so a retried best-effort call after a mediator
 * mutation never creates a duplicate timeline entry. Returns null (never
 * throws) on any validation failure or duplicate — this is a best-effort
 * side effect that must never roll back an already-committed mediator
 * state.
 */
export async function appendMediatorActivity(input: StrictMediatorActivityInput): Promise<ActivityItem | null> {
  if (!MEDIATOR_ACTIVITY_EVENT_KEYS.includes(input.eventKey)) return null;

  const title = await casesService.getCaseTitle(input.caseId);
  if (!title) return null;

  const id = `mediator-activity-${input.caseId}-${input.eventKey}`;
  if (mockActivity.some((item) => item.id === id)) return null;

  const item: ActivityItem = {
    id,
    eventKey: input.eventKey,
    createdAt: new Date().toISOString(),
    caseId: input.caseId,
    destination: { type: 'mediator', caseId: input.caseId },
  };

  const committed = await delay(item, 200);
  mockActivity.push(committed);
  return { ...committed };
}

const CASE_ACTIVITY_EVENT_KEYS = ['invitation_accepted'] as const satisfies readonly ActivityEventKey[];
export type CaseActivityEventKey = (typeof CASE_ACTIVITY_EVENT_KEYS)[number];

export type StrictCaseActivityInput = { caseId: string; eventKey: CaseActivityEventKey };

/**
 * Narrow, validated append surface for the case-lifecycle demo actions
 * only (phase 9's simulated invitation acceptance) — reuses the existing
 * `invitation_accepted` shared-safe event key (already part of
 * ActivityEventKey and already seeded for case-1/2/3) rather than
 * inventing a new one. Destination is always `{ type: 'case', caseId }`,
 * fixed internally. Dedupes deterministically on a
 * `case-activity-${caseId}-${eventKey}` id so a retried best-effort call
 * is a guaranteed no-op. Returns null (never throws) on any validation
 * failure or duplicate.
 */
export async function appendCaseActivity(input: StrictCaseActivityInput): Promise<ActivityItem | null> {
  if (!CASE_ACTIVITY_EVENT_KEYS.includes(input.eventKey)) return null;

  const title = await casesService.getCaseTitle(input.caseId);
  if (!title) return null;

  const id = `case-activity-${input.caseId}-${input.eventKey}`;
  if (mockActivity.some((item) => item.id === id)) return null;

  const item: ActivityItem = {
    id,
    eventKey: input.eventKey,
    createdAt: new Date().toISOString(),
    caseId: input.caseId,
    destination: { type: 'case', caseId: input.caseId },
  };

  const committed = await delay(item, 200);
  mockActivity.push(committed);
  return { ...committed };
}
