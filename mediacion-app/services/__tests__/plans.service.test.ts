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
    // Six since 21/08. The monetización seed added `particular` and
    // `corporativo` and left the four legacy rows untouched — DB called it
    // "aditivo puro". There is no `activo` column and `GET /planes` takes no
    // filter, so this really is what Mi plan lists today
    // (`docs/plan-frontend-monetizacion.md` §1.2).
    const service = createMockPlansService();
    const plans = await service.listPlanes();
    const nombres = plans.map((p) => p.nombre).sort();
    expect(nombres).toEqual([
      'base',
      'corporativo',
      'estudio',
      'particular',
      'plus',
      'simple',
    ]);
  });

  it('seeds the two period quotas exactly where the migration set them', async () => {
    const service = createMockPlansService();
    const plans = await service.listPlanes();
    const by = (nombre: string) => plans.find((p) => p.nombre === nombre);

    // `20260821120000_monetizacion_fase1.sql:283-296` fills only these two.
    expect(by('estudio')).toEqual(
      expect.objectContaining({ maxNegotiationsPerPeriod: 3, maxClientsPerPeriod: 20 }),
    );
    expect(by('particular')).toEqual(
      expect.objectContaining({ maxNegotiationsPerPeriod: 3, maxClientsPerPeriod: null }),
    );
    // The legacy rows were never given one, and `consume_quota` reads that
    // NULL as unlimited.
    expect(by('base')).toEqual(
      expect.objectContaining({ maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null }),
    );
  });

  it('reproduces the two pricing ambiguities the catalog still has, rather than tidying them away', async () => {
    // Both are open decisions on the DB/Producto side (§1.2 and §1.3), and the
    // mock is where they have to stay visible: `corporativo` is meant to read
    // "a consultar" but its precio is 0.00, which is indistinguishable from the
    // genuinely free `base`. A mock that quietly fixed this would hide the bug
    // from every screen that renders a price.
    const service = createMockPlansService();
    const plans = await service.listPlanes();

    expect(plans.find((p) => p.nombre === 'corporativo')?.precio).toBe(0);
    expect(plans.find((p) => p.nombre === 'base')?.precio).toBe(0);
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

  it("defaults moneda to 'ARS' on create, mirroring the planes.moneda column default (punto #24)", async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    expect(created.moneda).toBe('ARS');
  });

  it("seeds every plan with moneda 'ARS', mirroring the real migration", async () => {
    const service = createMockPlansService();
    const plans = await service.listPlanes();
    expect(plans).toHaveLength(6);
    for (const plan of plans) {
      expect(plan.moneda).toBe('ARS');
    }
  });

  it("rejects creating with a moneda other than 'ARS' — the planes_moneda_check CHECK on the real table", async () => {
    const service = createMockPlansService();
    await expect(service.createPlan(makeInput({ moneda: 'USD' }))).rejects.toThrow('plan_moneda_invalid');
  });

  it("rejects updating to a moneda other than 'ARS' — same CHECK as create", async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    await expect(service.updatePlan(created.id, makeInput({ moneda: 'USD' }))).rejects.toThrow('plan_moneda_invalid');
  });

  it('an update that says nothing about moneda keeps the existing one — never clobbered to undefined by the spread', async () => {
    const service = createMockPlansService();
    const created = await service.createPlan(makeInput());
    const updated = await service.updatePlan(created.id, makeInput({ moneda: undefined, precio: 30 }));
    expect(updated.moneda).toBe('ARS');
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
