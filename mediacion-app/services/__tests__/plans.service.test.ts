import { __resetMockPlans, createMockPlansService } from '../plans.service';
import type { PlanInput } from '../../types/plan';

function makeInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    nombre: 'premium',
    limiteCarpetas: 20,
    limiteCasos: 10,
    limiteIteracionesIa: 30,
    precio: 15,
    ...overrides,
  };
}

describe('plans.service — R-10 admin ABM', () => {
  // The mock store is module-level (like cases.service.ts's mockCases), not
  // per-instance — createMockPlansService() returns methods over the shared
  // store, not a fresh one. Resetting between tests is what actually
  // isolates them.
  beforeEach(() => {
    __resetMockPlans();
  });

  it('lists the seeded plans, mirroring the real migrations', async () => {
    const service = createMockPlansService();
    const plans = await service.listPlanes();
    const nombres = plans.map((p) => p.nombre).sort();
    expect(nombres).toEqual(['base', 'estudio', 'plus', 'simple']);
  });

  it('seeds the estudio plan with limiteCasos null (R-10) and the other limits at 0, per the real migration', async () => {
    const service = createMockPlansService();
    const plans = await service.listPlanes();
    const estudio = plans.find((p) => p.nombre === 'estudio');
    expect(estudio).toEqual(
      expect.objectContaining({ limiteCasos: null, limiteCarpetas: 0, limiteIteracionesIa: 0, precio: 25 }),
    );
  });

  it('creates a plan and makes it listable', async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    expect(created.id).toBeTruthy();
    expect(created.nombre).toBe('premium');

    const plans = await service.listPlanes();
    expect(plans.some((p) => p.id === created.id)).toBe(true);
  });

  it('rejects a duplicate nombre — UNIQUE on the real table', async () => {
    const service = createMockPlansService();
    await expect(service.createPlan(makeInput({ nombre: 'base' }))).rejects.toThrow('plan_nombre_taken');
  });

  it('trims nombre on create', async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput({ nombre: '  premium  ' }));
    expect(created.nombre).toBe('premium');
  });

  it('updates a plan in place', async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    const updated = await service.updatePlan(created.id, makeInput({ nombre: 'premium', precio: 30 }));
    expect(updated.precio).toBe(30);

    const fetched = await service.getPlan(created.id);
    expect(fetched?.precio).toBe(30);
  });

  it('rejects updating to a nombre already used by a different plan', async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    await expect(service.updatePlan(created.id, makeInput({ nombre: 'base' }))).rejects.toThrow('plan_nombre_taken');
  });

  it('allows updating a plan without changing its own nombre', async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    await expect(service.updatePlan(created.id, makeInput({ nombre: 'premium', precio: 99 }))).resolves.toEqual(
      expect.objectContaining({ precio: 99 }),
    );
  });

  it('rejects updating a plan that does not exist', async () => {
    const service = createMockPlansService();
    await expect(service.updatePlan('does-not-exist', makeInput())).rejects.toThrow('plan_not_found');
  });

  it('deletes a plan', async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    await service.deletePlan(created.id);
    const plans = await service.listPlanes();
    expect(plans.some((p) => p.id === created.id)).toBe(false);
  });

  it('rejects deleting a plan that does not exist', async () => {
    const service = createMockPlansService();
    await expect(service.deletePlan('does-not-exist')).rejects.toThrow('plan_not_found');
  });
});
