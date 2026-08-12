import { generateMockPlanId } from '../utils/mock-id';
import type { Plan, PlanInput } from '../types/plan';
import { mockPlans } from '../mocks/plans';
import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * R-10 admin ABM (alta/baja/modificación) de planes. Fully mock-only, no
 * `services/api/plans.*` counterpart yet: `apps/api` only exposes
 * `GET /planes` today (read-only) — the admin CRUD endpoints
 * (`POST`/`PATCH`/`DELETE /planes`, `@Roles('admin')`) are still a backend
 * TODO per `docs/plan-implementacion-07-08-2026.md`. This mirrors the
 * `mediator.service.ts` precedent: a real backend table exists but this
 * feature stays entirely frontend-mocked until the write endpoints do.
 *
 * Reachability: gated behind `profile.rol === 'admin'` in the UI
 * (`app/(tabs)/profile.tsx`), and this app's single seeded persona
 * (`mocks/profile.ts`) is always `'parte'` — there is no role switcher in
 * this phase. So, like phase 8's non-`case-1` mediator-assignment paths,
 * this feature is fully built and tested but not reachable through the live
 * demo persona; it is direct-navigation/code-review-only until a real
 * multi-role auth phase exists.
 */
export type PlansService = {
  listPlanes(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  createPlan(input: PlanInput): Promise<Plan>;
  updatePlan(id: string, input: PlanInput): Promise<Plan>;
  deletePlan(id: string): Promise<void>;
};

/** In-memory only — cleared on app restart, never written to disk. Seeded from the real migrations (see mocks/plans.ts). */
let plans: Plan[] = [...mockPlans];

const failures = createFailureController<'createPlan' | 'updatePlan' | 'deletePlan'>();

export function __mockForcePlansFailure(operation: 'createPlan' | 'updatePlan' | 'deletePlan'): void {
  failures.force(operation);
}

/** Test-only: resets the in-memory store back to the seed. Never imported by a screen. */
export function __resetMockPlans(): void {
  plans = [...mockPlans];
}

function normalizeInput(input: PlanInput): PlanInput {
  return { ...input, nombre: input.nombre.trim() };
}

export function createMockPlansService(): PlansService {
  return {
    async listPlanes() {
      return delay([...plans], 400);
    },

    async getPlan(id) {
      return delay(plans.find((plan) => plan.id === id), 300);
    },

    async createPlan(rawInput) {
      if (failures.consume('createPlan')) {
        return rejectAfter('mock_create_plan_failed', 500);
      }
      const input = normalizeInput(rawInput);
      // `nombre` is UNIQUE on the real table — enforced here too, so the
      // mock cannot silently drift from what the backend would reject.
      if (plans.some((plan) => plan.nombre === input.nombre)) {
        return rejectAfter('plan_nombre_taken', 400);
      }
      const created: Plan = { id: generateMockPlanId(), ...input };
      const committed = await delay(created, 700);
      plans = [...plans, committed];
      return committed;
    },

    async updatePlan(id, rawInput) {
      if (failures.consume('updatePlan')) {
        return rejectAfter('mock_update_plan_failed', 500);
      }
      const existing = plans.find((plan) => plan.id === id);
      if (!existing) {
        return rejectAfter('plan_not_found', 300);
      }
      const input = normalizeInput(rawInput);
      if (plans.some((plan) => plan.id !== id && plan.nombre === input.nombre)) {
        return rejectAfter('plan_nombre_taken', 400);
      }
      const updated: Plan = { ...existing, ...input };
      const committed = await delay(updated, 700);
      plans = plans.map((plan) => (plan.id === id ? committed : plan));
      return committed;
    },

    async deletePlan(id) {
      if (failures.consume('deletePlan')) {
        return rejectAfter('mock_delete_plan_failed', 500);
      }
      if (!plans.some((plan) => plan.id === id)) {
        return rejectAfter('plan_not_found', 300);
      }
      await delay(undefined, 500);
      plans = plans.filter((plan) => plan.id !== id);
    },
  };
}

/** Default instance consumed by the admin feature hooks. */
export const plansService: PlansService = createMockPlansService();
