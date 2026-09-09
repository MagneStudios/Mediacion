import type { BreachNotice, EstadoAcuerdo } from '@/types/agreement';

import type { ApiAcuerdo } from '../agreement-mapper';
import { createBackedAgreementsService } from '../agreements.backed-service';
import type { ApiAgreementsService } from '../agreements.api-service';

function acuerdo(estado: EstadoAcuerdo): ApiAcuerdo {
  return {
    id: 'acu-1',
    caso_id: 'caso-1',
    contenido: { contenido: { meetingPoint: [], narrative: 'texto' }, fundamentacion: null },
    documento_url: null,
    docusign_envelope_id: null,
    estado,
    fecha: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };
}

const notice: BreachNotice = {
  id: 'inc-1',
  agreementId: 'acu-1',
  reporterId: 'user-9',
  description: 'No cumplió con la entrega.',
  fecha: '2026-08-20T12:00:00.000Z',
};

function fakeApi(overrides: Partial<ApiAgreementsService> = {}): ApiAgreementsService {
  return {
    getForCase: jest.fn().mockResolvedValue({ acuerdo: acuerdo('firmado'), firmas: [] }),
    generate: jest.fn().mockResolvedValue(acuerdo('borrador')),
    sendToSignature: jest.fn().mockResolvedValue(acuerdo('enviado_a_firma')),
    registerBreach: jest.fn().mockResolvedValue(notice),
    listBreachNotices: jest.fn().mockResolvedValue([notice]),
    exportAgreement: jest.fn().mockResolvedValue('ACUERDO DE MEDIACIÓN'),
    listSignatureInbox: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const deps = {
  getCaseTitle: async () => 'Custodia',
  getAcceptedRoundNumber: async () => 2,
  getCurrentUserId: async () => 'user-1',
};

describe('agreements.backed-service — reportBreach', () => {
  it('re-reads the agreement instead of assuming the estado the write caused', async () => {
    // The server flips the acuerdo to `con_aviso` in the same transaction.
    // Patching that locally would be a guess; this reads it back.
    const getForCase = jest
      .fn()
      .mockResolvedValueOnce({ acuerdo: acuerdo('con_aviso'), firmas: [] });
    const api = fakeApi({ getForCase });
    const service = createBackedAgreementsService(api, deps);

    const state = await service.reportBreach('caso-1', 'acu-1', 'algo pasó');

    expect(api.registerBreach).toHaveBeenCalledWith('acu-1', 'algo pasó');
    expect(getForCase).toHaveBeenCalledWith('caso-1');
    expect(state.agreement.estado).toBe('con_aviso');
  });

  it('does not re-read when the write failed', async () => {
    const getForCase = jest.fn();
    const api = fakeApi({
      getForCase,
      registerBreach: jest.fn().mockRejectedValue(new Error('acuerdo_not_firmado')),
    });

    await expect(
      createBackedAgreementsService(api, deps).reportBreach('caso-1', 'acu-1', 'algo pasó'),
    ).rejects.toThrow('acuerdo_not_firmado');
    expect(getForCase).not.toHaveBeenCalled();
  });

  it('fails loudly when the agreement is unreadable right after the write', async () => {
    // A registered notice with no state to show is a broken screen, not a
    // silent null: the caller has to know the re-read did not happen.
    const api = fakeApi({ getForCase: jest.fn().mockResolvedValue(null) });

    await expect(
      createBackedAgreementsService(api, deps).reportBreach('caso-1', 'acu-1', 'algo pasó'),
    ).rejects.toThrow(/caso-1/);
  });
});

describe('agreements.backed-service — notices and export', () => {
  it('passes the notices through untouched', async () => {
    const api = fakeApi();

    await expect(
      createBackedAgreementsService(api, deps).getBreachNotices('acu-1'),
    ).resolves.toEqual([notice]);
    expect(api.listBreachNotices).toHaveBeenCalledWith('acu-1');
  });

  it('wraps the exported text without touching it', async () => {
    const api = fakeApi({ exportAgreement: jest.fn().mockResolvedValue('línea 1\nlínea 2') });

    await expect(
      createBackedAgreementsService(api, deps).exportAgreement('acu-1'),
    ).resolves.toEqual({ document: 'línea 1\nlínea 2' });
  });

  it('propagates an export failure rather than answering an empty document', async () => {
    // An empty string would render as a successful export of nothing.
    const api = fakeApi({
      exportAgreement: jest.fn().mockRejectedValue(new Error('network_unavailable')),
    });

    await expect(
      createBackedAgreementsService(api, deps).exportAgreement('acu-1'),
    ).rejects.toThrow('network_unavailable');
  });
});
