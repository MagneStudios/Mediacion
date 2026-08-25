import type { Plan } from '@/types/plan';

import type { ApiPlansService } from './plans.api-service';
import type { PlansService } from '../plans.service';

/**
 * Rejection reason for the three ABM writes. Distinct from the mock's
 * `mock_create_plan_failed` family on purpose: this is not a simulated
 * failure, it is the absence of an endpoint.
 */
export const errorPlansWriteUnavailable = 'plans_write_unavailable';

/**
 * Presents the real `GET /planes` under the `PlansService` contract the plan
 * screens already consume.
 *
 * **What is real:** `listPlanes` and `getPlan`. That closes the gap BE flagged
 * in `docs/changelogs/2026-08-23.md` — the catalog was running on a mock
 * mirrored by hand against the migrations, so a change to the seeds or to
 * `planColumns` never reached the app.
 *
 * **What is unavailable, and why it is not mocked:** `createPlan`,
 * `updatePlan` and `deletePlan`. The API exposes the read and nothing else —
 * there is no `POST`/`PATCH`/`DELETE /planes` (`pagos.module.ts`), and DB left
 * the admin CRUD as a separate ticket. Delegating them to the in-memory mock
 * would be worse than failing: the write would report success, the list would
 * re-read the server, and the plan the admin just "created" would not be
 * there. So they reject, and the ABM screens show their error state — the same
 * rule the agreement screen's export and breach placeholders already follow
 * (never fabricate a success without a real call behind it).
 *
 * **The visible consequence, stated out loud:** with a backend configured the
 * admin ABM at `app/admin/planes` becomes read-only. That is the truth of the
 * current API surface, not a regression this file introduces.
 */
export function createBackedPlansService(api: ApiPlansService): PlansService {
  function writeUnavailable(): Promise<never> {
    return Promise.reject(new Error(errorPlansWriteUnavailable));
  }

  return {
    listPlanes(): Promise<Plan[]> {
      return api.listPlanes();
    },

    /**
     * Derived from the list: there is no `GET /planes/:id`. The extra round
     * trip is the honest cost of the endpoint that exists — a cached copy
     * would be a second source of truth for a catalog the server owns, and
     * the two callers (the checkout header and the mock checkout's price
     * lookup) read it once per screen, not per render.
     *
     * `undefined` for an unknown id, matching the mock: a plan that is not in
     * the catalog is a normal answer for a stale link, not a failure.
     */
    async getPlan(id: string): Promise<Plan | undefined> {
      const plans = await api.listPlanes();
      return plans.find((plan) => plan.id === id);
    },

    createPlan: writeUnavailable,
    updatePlan: writeUnavailable,
    deletePlan: writeUnavailable,
  };
}
