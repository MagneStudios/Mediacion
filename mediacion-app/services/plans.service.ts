import { createBackedPlansService } from './api/plans.backed-service';
import { backend } from './backend-instance';
import { generateMockPlanId } from '../utils/mock-id';
import type { Plan, PlanInput } from '../types/plan';
import { mockPlans } from '../mocks/plans';
import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * El catálogo de planes (R-09) y el ABM de admin (R-10).
 *
 * **Read live as of 25/08/2026.** `GET /planes` was always there, but the
 * catalog kept running on the mock below, mirrored by hand against the
 * migrations — BE flagged it in `docs/changelogs/2026-08-23.md` when they
 * added `planes.moneda` and the app had no way to notice. The singleton at
 * the bottom of this file now resolves `listPlanes`/`getPlan` to the real API
 * whenever a backend is configured.
 *
 * The three writes have no endpoint: `apps/api` exposes the read and nothing
 * else (`pagos.module.ts`), and the admin CRUD is still a backend TODO per
 * `docs/plan-implementacion-07-08-2026.md`. With a backend live they reject
 * rather than falling back to this mock, which would report a success the
 * server never saw — `services/api/plans.backed-service.ts` states the split
 * and its visible consequence. The mock below is what runs offline, whole.
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

// Mirrors the DB CHECK (`planes_moneda_check`, `moneda IN ('ARS')`): a moneda
// the real table would reject must not silently succeed in the mock. An
// omitted moneda is fine — the column default covers it.
function violatesMonedaCheck(input: PlanInput): boolean {
  return input.moneda !== undefined && input.moneda !== 'ARS';
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
      if (violatesMonedaCheck(input)) {
        return rejectAfter('plan_moneda_invalid', 400);
      }
      // `moneda` mirrors the DB column default ('ARS'): the ABM has no
      // currency picker, so an omitted moneda gets what the schema would set.
      const created: Plan = { id: generateMockPlanId(), ...input, moneda: input.moneda ?? 'ARS' };
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
      if (violatesMonedaCheck(input)) {
        return rejectAfter('plan_moneda_invalid', 400);
      }
      // The spread would overwrite `moneda` with `undefined` when the input
      // carries the key without a value — an update that says nothing about
      // the currency keeps the row's.
      const updated: Plan = { ...existing, ...input, moneda: input.moneda ?? existing.moneda };
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

/**
 * Default instance consumed by `usePlans` (the party-facing catalog and the
 * admin list alike) and by the checkout — the real `GET /planes` when a
 * backend is configured, the full mock otherwise. Same selection idiom as
 * `billing.service.ts` and `legal.service.ts`.
 */
export const plansService: PlansService = backend
  ? createBackedPlansService(backend.plans)
  : createMockPlansService();
