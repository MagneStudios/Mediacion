import type { PlansService } from '../plans.service';

/**
 * The backend/mock ternary at the bottom of `plans.service.ts` decides, at
 * module evaluation, whether the catalog comes from `GET /planes` or from the
 * in-memory mock. It runs once per process, so exercising both branches needs
 * `jest.isolateModules` to re-evaluate the module against a different
 * `backend-instance` each time — same idiom as `billing.singleton.test.ts`.
 */

let mockBackend: { plans: unknown } | null = null;
jest.mock('../backend-instance', () => ({
  get backend() {
    return mockBackend;
  },
  get isBackendLive() {
    return mockBackend !== null;
  },
}));

const backedSentinel = { __kind: 'backed' } as unknown as PlansService;
const mockCreateBackedPlansService = jest.fn((..._args: unknown[]) => backedSentinel);
jest.mock('../api/plans.backed-service', () => ({
  createBackedPlansService: (...args: unknown[]) => mockCreateBackedPlansService(...args),
}));

function loadPlansService(): PlansService {
  let loaded: PlansService | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<typeof import('../plans.service')>('../plans.service').plansService;
  });
  if (!loaded) {
    throw new Error('plans.service did not evaluate');
  }
  return loaded;
}

describe('plansService singleton selection', () => {
  beforeEach(() => {
    mockCreateBackedPlansService.mockClear();
    mockBackend = null;
  });

  it('exports the backed service when a backend is configured', () => {
    const plansApi = { __kind: 'api' };
    mockBackend = { plans: plansApi };

    const service = loadPlansService();

    expect(service).toBe(backedSentinel);
    expect(mockCreateBackedPlansService).toHaveBeenCalledTimes(1);
    // No mock fallback is passed, and that is the point: the writes have no
    // endpoint and must not quietly land in an in-memory store nobody reads.
    expect(mockCreateBackedPlansService.mock.calls[0]).toEqual([plansApi]);
  });

  it('exports the pure mock when no backend is configured', async () => {
    mockBackend = null;

    const service = loadPlansService();

    // Identity + behavior, not shape: the mock branch is pinned by a
    // mock-only capability actually answering — the backed service rejects
    // every write, so a create that resolves can only be the mock.
    expect(service).not.toBe(backedSentinel);
    expect(mockCreateBackedPlansService).not.toHaveBeenCalled();
    await expect(
      service.createPlan({
        nombre: 'singleton-probe',
        limiteCarpetas: 1,
        limiteCasos: 1,
        limiteIteracionesIa: 1,
        precio: 1,
      }),
    ).resolves.toEqual(expect.objectContaining({ nombre: 'singleton-probe' }));
  });
});
