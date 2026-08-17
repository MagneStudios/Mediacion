import type { MockInvoice, MockSubscription } from '@/types/billing';

import { ApiError, codeSuscripcionNotFound } from '../api-error';
import type { ApiBillingService } from '../billing.api-service';
import { createBackedBillingService } from '../billing.backed-service';
import type { BillingService } from '../../billing.service';

const activa: MockSubscription = {
  id: 'e0c2a0f8-1111-4222-8333-444455556666',
  planId: 'plan-1',
  estado: 'activa',
  fechaInicio: '2026-08-01T00:00:00.000Z',
  fechaFin: null,
};

const invoice = { id: 'fac-1' } as MockInvoice;

function fakeApi(overrides: Partial<ApiBillingService> = {}): ApiBillingService {
  return {
    getCurrentSubscription: jest.fn().mockResolvedValue(activa),
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
