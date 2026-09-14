import { lawyerFeeFixture } from '../../lawyer.service';
import { createBackedLawyerService } from '../lawyer.backed-service';
import type { ApiLawyerService, ApiSolicitudAbogadoView } from '../lawyer.api-service';

function row(overrides: Partial<ApiSolicitudAbogadoView> = {}): ApiSolicitudAbogadoView {
  return {
    id: 'lawreq-0001',
    caso_id: 'caso-1',
    status: 'pendiente_pago',
    moneda: 'ARS',
    monto_minor: 5_000_000,
    external_reference: 'lawreq_lawreq-0001',
    paid_at: null,
    created_at: '2026-09-03T12:00:00.000Z',
    ...overrides,
  };
}

function fakeApi(overrides: Partial<ApiLawyerService> = {}): ApiLawyerService {
  return {
    getRequest: jest.fn().mockResolvedValue(row()),
    requestLawyer: jest.fn().mockResolvedValue({
      solicitud: row(),
      init_point: 'https://mp/checkout/1',
    }),
    ...overrides,
  };
}

describe('lawyer.backed-service', () => {
  it('getOffer siempre devuelve scope y responseHours en null — es el estado real, no un bug', async () => {
    const offer = await createBackedLawyerService(fakeApi()).getOffer();

    expect(offer.fee).toEqual(lawyerFeeFixture);
    expect(offer.scope).toBeNull();
    expect(offer.responseHours).toBeNull();
  });

  it('getRequest mapea la fila al dominio y propaga null sin error', async () => {
    const service = createBackedLawyerService(fakeApi());

    await expect(service.getRequest('caso-1')).resolves.toEqual({
      id: 'lawreq-0001',
      casoId: 'caso-1',
      estado: 'pendiente_pago',
      fee: { currency: 'ARS', amountMinor: 5_000_000 },
      createdAt: '2026-09-03T12:00:00.000Z',
      handoff: null,
    });

    const empty = createBackedLawyerService(
      fakeApi({ getRequest: jest.fn().mockResolvedValue(null) }),
    );
    await expect(empty.getRequest('caso-1')).resolves.toBeNull();
  });

  it('requestLawyer arma el checkout del dominio: request + checkoutUrl (traducido de init_point)', async () => {
    const requestLawyer = jest.fn().mockResolvedValue({
      solicitud: row(),
      init_point: 'https://mp/checkout/1',
    });

    const result = await createBackedLawyerService(fakeApi({ requestLawyer })).requestLawyer('caso-1');

    expect(requestLawyer).toHaveBeenCalledWith('caso-1');
    expect(result.checkoutUrl).toBe('https://mp/checkout/1');
    expect(result.request.id).toBe('lawreq-0001');
    expect(result.request.estado).toBe('pendiente_pago');
  });

  it('simulatePaymentConfirmation es un re-read no-op; rechaza si no hay solicitud', async () => {
    const service = createBackedLawyerService(fakeApi());

    await expect(service.simulatePaymentConfirmation('caso-1')).resolves.toMatchObject({
      id: 'lawreq-0001',
    });

    const empty = createBackedLawyerService(
      fakeApi({ getRequest: jest.fn().mockResolvedValue(null) }),
    );
    await expect(empty.simulatePaymentConfirmation('caso-1')).rejects.toThrow(
      'mock_lawyer_request_not_found',
    );
  });
});
