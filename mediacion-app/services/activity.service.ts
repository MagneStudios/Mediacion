import { buildInitialActivity } from '../mocks/activity';
import type { ActivityItem, ActivityListItem } from '../types/activity';
import { casesService } from './cases.service';
import { delay } from './mock-utils';

/**
 * Replaceable service boundary for the read-only "Actividad del proceso"
 * timeline.
 *
 * PRIVACY / SCOPE BOUNDARY: this file never imports positionsService or
 * PositionItem, and never mutates any store — `mockActivity` is immutable
 * after seeding. The only cross-feature dependency is
 * `casesService.getCaseTitle()`, the same public read accessor
 * notices.service.ts uses, for a safe display title only.
 */
export type ActivityService = {
  listActivity(): Promise<ActivityListItem[]>;
};

/** In-memory only, immutable after seeding. */
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
