import {
  __mockForceBillingFailure,
  __mockSetNegotiationsUsed,
  __resetMockBilling,
  createMockBillingService,
} from '../billing.service';
import { __resetMockPlans, plansService } from '../plans.service';

describe('billing.service — R-09 checkout', () => {
  beforeEach(() => {
    __resetMockBilling();
    __resetMockPlans();
  });

  it('has no current subscription initially', async () => {
    const service = createMockBillingService();
    await expect(service.getCurrentSubscription()).resolves.toBeNull();
  });

  it('rejects subscribing to a plan that does not exist', async () => {
    const service = createMockBillingService();
    await expect(service.subscribeToPlan('does-not-exist')).rejects.toThrow('plan_not_found');
  });

  it('subscribing commits an active subscription and an emitted invoice with the discriminated breakdown', async () => {
    const service = createMockBillingService();
    // 'plan-estudio' is seeded at precio 25 — see mocks/plans.ts.
    const result = await service.subscribeToPlan('plan-estudio');

    expect(result.subscription).toEqual(
      expect.objectContaining({ planId: 'plan-estudio', estado: 'activa' }),
    );
    expect(result.invoice).toEqual(
      expect.objectContaining({ estado: 'emitida', neto: 25, iva: 5.25, impuestos: 0, total: 30.25 }),
    );
  });

  it("the invoice snapshots the plan's moneda — the comprobante formats with data, never a literal (punto #24)", async () => {
    const service = createMockBillingService();
    const plan = await plansService.getPlan('plan-estudio');

    const { invoice } = await service.subscribeToPlan('plan-estudio');

    expect(plan?.moneda).toBe('ARS');
    expect(invoice.moneda).toBe(plan?.moneda);
  });

  it('becomes the current subscription after subscribing', async () => {
    const service = createMockBillingService();
    const { subscription } = await service.subscribeToPlan('plan-base');
    await expect(service.getCurrentSubscription()).resolves.toEqual(subscription);
  });

  it('the invoice is retrievable by the new subscription id', async () => {
    const service = createMockBillingService();
    const { subscription, invoice } = await service.subscribeToPlan('plan-base');
    await expect(service.getInvoiceForSubscription(subscription.id)).resolves.toEqual(invoice);
  });

  it('a forced failure leaves no subscription and no invoice behind', async () => {
    const service = createMockBillingService();
    __mockForceBillingFailure('subscribeToPlan');
    await expect(service.subscribeToPlan('plan-base')).rejects.toThrow('mock_subscribe_failed');
    await expect(service.getCurrentSubscription()).resolves.toBeNull();
  });

  it('prepareInvoiceDownload resolves for a real invoice', async () => {
    const service = createMockBillingService();
    const { invoice } = await service.subscribeToPlan('plan-base');
    await expect(service.prepareInvoiceDownload(invoice.id)).resolves.toBeUndefined();
  });

  it('prepareInvoiceDownload rejects for an unknown invoice id', async () => {
    const service = createMockBillingService();
    await expect(service.prepareInvoiceDownload('does-not-exist')).rejects.toThrow('invoice_not_found');
  });

  describe('getUsage', () => {
    it('reports no usage while there is no subscription to measure against', async () => {
      // Mirrors BE's 404, which the backed service maps to null. It is a normal
      // state, not a failure.
      const service = createMockBillingService();
      await expect(service.getUsage()).resolves.toBeNull();
    });

    it("reads the limits off the subscribed plan, and starts the counter at zero", async () => {
      // Zero because nothing in this app consumes the quota: it is spent by
      // `POST /casos` on the server, and the mock case service knows nothing
      // about billing. BE returns 0 for the same reason when `usage_counters`
      // has no row yet.
      const service = createMockBillingService();
      await service.subscribeToPlan('plan-estudio');

      const usage = await service.getUsage();

      // 'plan-estudio' is seeded at 3 negotiations / 20 clients — see mocks/plans.ts.
      expect(usage?.negotiations).toEqual({ used: 0, limit: 3 });
      expect(usage?.clients).toEqual({ used: 0, limit: 20 });
    });

    it('reports a plan with no period quota as unlimited rather than as capped at zero', async () => {
      // 'plan-base' has both columns at NULL, which `consume_quota` reads as
      // unlimited in as many words.
      const service = createMockBillingService();
      await service.subscribeToPlan('plan-base');

      const usage = await service.getUsage();

      expect(usage?.negotiations).toEqual({ used: 0, limit: null });
      // No client quota on the plan means the mock has nothing to resolve a
      // clients counter from, so it reports none — the same shape BE sends to
      // anyone who is not the titular of an estudio.
      expect(usage?.clients).toBeNull();
    });

    it('stops reporting usage once the subscription is cancelled', async () => {
      // BE reports usage for `activa`/`vencida` only — the same set
      // `consume_quota` accepts — and 404s for everything else.
      const service = createMockBillingService();
      await service.subscribeToPlan('plan-estudio');
      await service.cancelSubscription();

      await expect(service.getUsage()).resolves.toBeNull();
    });

    it('reflects a spent counter, including one sitting exactly at the limit', async () => {
      const service = createMockBillingService();
      await service.subscribeToPlan('plan-estudio');
      __mockSetNegotiationsUsed(3);

      const usage = await service.getUsage();

      expect(usage?.negotiations).toEqual({ used: 3, limit: 3 });
    });
  });
});
