import type { BillingService } from '../billing.service';

/**
 * The backend/mock ternary at the bottom of `billing.service.ts` decides, at
 * module evaluation, whether the app talks to the real subscription endpoints
 * or stays fully mocked. It runs once per process, so exercising both branches
 * needs `jest.isolateModules` to re-evaluate the module against a different
 * `backend-instance` each time — deuda de test anotada en el changelog 17/08.
 */

let mockBackend: { billing: unknown } | null = null;
jest.mock('../backend-instance', () => ({
  get backend() {
    return mockBackend;
  },
  get isBackendLive() {
    return mockBackend !== null;
  },
}));

const backedSentinel = { __kind: 'backed' } as unknown as BillingService;
const mockCreateBackedBillingService = jest.fn(
  (..._args: unknown[]) => backedSentinel,
);
jest.mock('../api/billing.backed-service', () => ({
  createBackedBillingService: (...args: unknown[]) =>
    mockCreateBackedBillingService(...args),
}));

// The module builds its mock fallback from the plan catalog; the singleton
// selection under test never touches it, so a stub keeps the import graph
// out of the picture.
jest.mock('../plans.service', () => ({
  plansService: { getPlan: jest.fn() },
}));

function loadBillingService(): BillingService {
  let loaded: BillingService | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<typeof import('../billing.service')>(
      '../billing.service',
    ).billingService;
  });
  if (!loaded) {
    throw new Error('billing.service did not evaluate');
  }
  return loaded;
}

describe('billingService singleton selection', () => {
  beforeEach(() => {
    mockCreateBackedBillingService.mockClear();
    mockBackend = null;
  });

  it('exports the backed service when a backend is configured', () => {
    const billingApi = { __kind: 'api' };
    mockBackend = { billing: billingApi };

    const service = loadBillingService();

    expect(service).toBe(backedSentinel);
    expect(mockCreateBackedBillingService).toHaveBeenCalledTimes(1);
    const [apiArgument, mockFallback] =
      mockCreateBackedBillingService.mock.calls[0] as unknown[];
    expect(apiArgument).toBe(billingApi);
    // The fallback handed to the backed service is the pure mock, so the
    // members without endpoints keep working offline.
    expect(mockFallback).toEqual(
      expect.objectContaining({
        subscribeToPlan: expect.any(Function),
        getInvoiceForSubscription: expect.any(Function),
        prepareInvoiceDownload: expect.any(Function),
      }),
    );
  });

  it('exports the pure mock when no backend is configured', async () => {
    mockBackend = null;

    const service = loadBillingService();

    // Identity + behavior, not shape: `objectContaining(expect.any(Function))`
    // passes for ANY BillingService, including the backed one. Not being the
    // backed sentinel plus a mock-only member actually answering (a fresh
    // in-memory store has no subscription) is what pins the pure-mock branch.
    expect(service).not.toBe(backedSentinel);
    expect(mockCreateBackedBillingService).not.toHaveBeenCalled();
    await expect(service.getCurrentSubscription()).resolves.toBeNull();
  });
});
