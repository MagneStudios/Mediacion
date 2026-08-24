import { __mockForceBillingFailure, __resetMockBilling, createMockBillingService } from '../billing.service';
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
});
