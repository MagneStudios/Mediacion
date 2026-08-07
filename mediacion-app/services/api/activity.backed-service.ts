import type { ActivityListItem } from '@/types/activity';

import type { ActivityService } from '../activity.service';
import type { ApiActivityService } from './activity.api-service';

/** The minimum the global feed needs from the cases stack, injected to keep this testable. */
export type CaseRef = { id: string; title: string };
export type CaseLister = () => Promise<CaseRef[]>;

/**
 * Presents the real API under the contract the Actividad screen already consumes.
 *
 * Two structural gaps between the screen and the API, neither of them faked:
 *
 * - The screen wants ONE global feed; the API only exposes
 *   `GET /casos/:casoId/actividad`. The feed is therefore assembled by fanning
 *   out over the caller's casos and merging. Titles come from the same list
 *   response, so resolving them costs no extra request — unlike the mock, which
 *   re-read each case individually.
 *
 * - Audit rows with no unambiguous milestone (`UPDATE_casos`, `UPDATE_acuerdos`)
 *   are dropped by the mapper. That means the real timeline is SPARSER than the
 *   mock's: estado transitions do not appear at all. Making them appear needs
 *   the API to expose a real event vocabulary rather than raw `auditoria` rows —
 *   it cannot be fixed on the client without guessing.
 */
export function createBackedActivityService(
  api: ApiActivityService,
  listCases: CaseLister,
): ActivityService {
  return {
    async listActivity(): Promise<ActivityListItem[]> {
      const cases = await listCases();
      const perCase = await Promise.all(
        cases.map(async (caseRef): Promise<ActivityListItem[]> => {
          // One caso failing must not blank the whole feed — the others are
          // still true and worth showing.
          try {
            const items = await api.listForCase(caseRef.id);
            return items.map((item) => ({ ...item, caseTitle: caseRef.title }));
          } catch {
            return [];
          }
        }),
      );
      return perCase
        .flat()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}
