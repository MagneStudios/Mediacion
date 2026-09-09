import type { MockInvoice, MockSubscription, SubscriptionUsage } from '@/types/billing';

import { ApiError, codeSuscripcionNotFound } from '../api-error';
import type { ApiBillingService } from '../billing.api-service';
import {
  createBackedBillingService,
  errorCheckoutUrlUnusable,
} from '../billing.backed-service';
import type { BillingService } from '../../billing.service';

const activa: MockSubscription = {
  id: 'e0c2a0f8-1111-4222-8333-444455556666',
  planId: 'plan-1',
  estado: 'activa',
  fechaInicio: '2026-08-01T00:00:00.000Z',
  fechaFin: null,
};

const invoice = { id: 'fac-1' } as MockInvoice;

const usage: SubscriptionUsage = {
  periodStart: '2026-08-17T12:00:00.000Z',
  periodEnd: '2026-09-16T12:00:00.000Z',
  negotiations: { used: 2, limit: 3 },
  clients: null,
};

function fakeApi(overrides: Partial<ApiBillingService> = {}): ApiBillingService {
  return {
    getCurrentSubscription: jest.fn().mockResolvedValue(activa),
    getUsage: jest.fn().mockResolvedValue(usage),
    createSubscription: jest.fn().mockResolvedValue({ id: 'sus-new', estado: 'pendiente_pago' }),
    startPayment: jest
      .fn()
      .mockResolvedValue({ init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1' }),
    cancelSubscription: jest.fn().mockResolvedValue({
      id: activa.id,
      estado: 'cancelada',
      fecha_fin: '2026-08-17T12:00:00.000Z',
    }),
    ...overrides,
  };
}

function fakeMock(overrides: Partial<BillingService> = {}): BillingService {
  return {
    getCurrentSubscription: jest.fn().mockResolvedValue(null),
    getUsage: jest.fn().mockResolvedValue(null),
    startCheckout: jest.fn().mockResolvedValue({ kind: 'simulated', subscription: activa, invoice }),
    getInvoiceForSubscription: jest.fn().mockResolvedValue(invoice),
    subscribeToPlan: jest.fn().mockResolvedValue({ subscription: activa, invoice }),
    prepareInvoiceDownload: jest.fn().mockResolvedValue(undefined),
    cancelSubscription: jest.fn().mockResolvedValue(activa),
    ...overrides,
  };
}

describe('billing.backed-service', () => {
  it('reads the current subscription from the server, id included', async () => {
    const service = createBackedBillingService(fakeApi(), fakeMock());

    await expect(service.getCurrentSubscription()).resolves.toEqual(activa);
  });

  it('maps suscripcion_not_found to null — "no tengo plan" is a normal state', async () => {
    const api = fakeApi({
      getCurrentSubscription: jest
        .fn()
        .mockRejectedValue(new ApiError(codeSuscripcionNotFound, 'Suscripcion not found', 404)),
    });

    await expect(
      createBackedBillingService(api, fakeMock()).getCurrentSubscription(),
    ).resolves.toBeNull();
  });

  it('reads the usage from the server', async () => {
    const api = fakeApi();

    await expect(createBackedBillingService(api, fakeMock()).getUsage()).resolves.toEqual(usage);
    expect(api.getUsage).toHaveBeenCalled();
  });

  it('maps suscripcion_not_found on the usage read to null, not to an error', async () => {
    // Same 404 the vigente read gets, and for the same two reasons: no plan, or
    // a plan that is not yours. It also covers the case BE documented as debt —
    // a member of an estudio who consumes against its plan but cannot read it.
    // Reporting that as a failure would put a retry button on a screen where
    // retrying cannot change the answer.
    const api = fakeApi({
      getUsage: jest
        .fn()
        .mockRejectedValue(new ApiError(codeSuscripcionNotFound, 'Suscripcion not found', 404)),
    });

    await expect(createBackedBillingService(api, fakeMock()).getUsage()).resolves.toBeNull();
  });

  it('propagates a usage failure that is not the 404, so the screen can offer a retry', async () => {
    const api = fakeApi({
      getUsage: jest.fn().mockRejectedValue(new ApiError('internal_error', 'boom', 500)),
    });

    await expect(createBackedBillingService(api, fakeMock()).getUsage()).rejects.toThrow('boom');
  });

  describe('startCheckout', () => {
    it('creates the subscription first, then asks for its checkout', async () => {
      // El orden no es estético: la preferencia de Mercado Pago se arma con la
      // fila de la suscripción, y su id viaja como `external_reference` — que
      // es lo único que después le dice al webhook a qué fila aplicar el pago.
      const api = fakeApi();

      const start = await createBackedBillingService(api, fakeMock()).startCheckout('plan-1');

      expect(api.createSubscription).toHaveBeenCalledWith('plan-1');
      expect(api.startPayment).toHaveBeenCalledWith('sus-new');
      expect((api.createSubscription as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        (api.startPayment as jest.Mock).mock.invocationCallOrder[0],
      );
      expect(start).toEqual({
        kind: 'redirect',
        subscriptionId: 'sus-new',
        checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1',
      });
    });

    it('never returns an invoice — nothing has been charged yet', async () => {
      // Es la razón por la que `startCheckout` existe aparte de
      // `subscribeToPlan`: el camino real no tiene factura que devolver, y
      // fabricar una sería reportar plata que nadie cobró.
      const start = await createBackedBillingService(fakeApi(), fakeMock()).startCheckout('plan-1');

      expect(start).not.toHaveProperty('invoice');
    });

    it('refuses an init_point that did not pass validation, rather than opening it', async () => {
      const api = fakeApi({
        startPayment: jest.fn().mockResolvedValue({ init_point: 'http://evil.example/checkout' }),
      });

      await expect(
        createBackedBillingService(api, fakeMock()).startCheckout('plan-1'),
      ).rejects.toThrow(errorCheckoutUrlUnusable);
    });

    it('does not fall back to the mock checkout when the server fails', async () => {
      // Un checkout simulado contra backend real le diría a alguien que
      // contrató cuando no contrató, y el gate C-01 lo dejaría afuera igual.
      const mock = fakeMock();
      const api = fakeApi({
        createSubscription: jest.fn().mockRejectedValue(new ApiError('internal_error', 'boom', 500)),
      });

      await expect(createBackedBillingService(api, mock).startCheckout('plan-1')).rejects.toThrow('boom');
      expect(mock.startCheckout).not.toHaveBeenCalled();
    });
  });

  it('propagates any other read failure so the screen can offer a retry', async () => {
    const api = fakeApi({
      getCurrentSubscription: jest
        .fn()
        .mockRejectedValue(new ApiError('network_unavailable', 'down', 0)),
    });

    await expect(
      createBackedBillingService(api, fakeMock()).getCurrentSubscription(),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('cancels the id the server reports, never a locally remembered one', async () => {
    const api = fakeApi();
    const service = createBackedBillingService(api, fakeMock());

    const cancelled = await service.cancelSubscription();

    expect(api.getCurrentSubscription).toHaveBeenCalledTimes(1);
    expect(api.cancelSubscription).toHaveBeenCalledWith(activa.id);
    expect(cancelled).toEqual({
      ...activa,
      estado: 'cancelada',
      fechaFin: '2026-08-17T12:00:00.000Z',
    });
  });

  it('never falls back to the mock for the baja — a fake success would hide a real failure', async () => {
    const api = fakeApi({
      cancelSubscription: jest.fn().mockRejectedValue(new ApiError('conflict', 'not activa', 409)),
    });
    const mock = fakeMock();

    await expect(
      createBackedBillingService(api, mock).cancelSubscription(),
    ).rejects.toBeInstanceOf(ApiError);
    expect(mock.cancelSubscription).not.toHaveBeenCalled();
  });

  it('leaves the checkout and the facturas on the mock, since neither has an endpoint', async () => {
    const mock = fakeMock();
    const service = createBackedBillingService(fakeApi(), mock);

    await service.subscribeToPlan('plan-1');
    await service.getInvoiceForSubscription('sus-1');
    await service.prepareInvoiceDownload('fac-1');

    expect(mock.subscribeToPlan).toHaveBeenCalledWith('plan-1');
    expect(mock.getInvoiceForSubscription).toHaveBeenCalledWith('sus-1');
    expect(mock.prepareInvoiceDownload).toHaveBeenCalledWith('fac-1');
  });
});
