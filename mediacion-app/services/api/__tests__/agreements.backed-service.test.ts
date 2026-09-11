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
    getById: jest.fn().mockResolvedValue({ acuerdo: acuerdo('firmado'), firmas: [] }),
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
  it('re-reads the agreement by its id instead of assuming the estado the write caused', async () => {
    // The server flips the acuerdo to `con_aviso` in the same transaction.
    // Patching that locally would be a guess; this reads it back — and by
    // acuerdo id: a caso can hold more than one, and re-reading by caso
    // could hand the screen a different document than the one written to.
    const getById = jest
      .fn()
      .mockResolvedValueOnce({ acuerdo: acuerdo('con_aviso'), firmas: [] });
    const getForCase = jest.fn();
    const api = fakeApi({ getById, getForCase });
    const service = createBackedAgreementsService(api, deps);

    const state = await service.reportBreach('caso-1', 'acu-1', 'algo pasó');

    expect(api.registerBreach).toHaveBeenCalledWith('acu-1', 'algo pasó');
    expect(getById).toHaveBeenCalledWith('acu-1');
    expect(getForCase).not.toHaveBeenCalled();
    expect(state.agreement.estado).toBe('con_aviso');
  });

  it('does not re-read when the write failed', async () => {
    const getById = jest.fn();
    const api = fakeApi({
      getById,
      registerBreach: jest.fn().mockRejectedValue(new Error('acuerdo_not_firmado')),
    });

    await expect(
      createBackedAgreementsService(api, deps).reportBreach('caso-1', 'acu-1', 'algo pasó'),
    ).rejects.toThrow('acuerdo_not_firmado');
    expect(getById).not.toHaveBeenCalled();
  });

  it('fails loudly when the agreement is unreadable right after the write', async () => {
    // A registered notice with no state to show is a broken screen, not a
    // silent null: the caller has to know the re-read did not happen.
    const api = fakeApi({ getById: jest.fn().mockResolvedValue(null) });

    await expect(
      createBackedAgreementsService(api, deps).reportBreach('caso-1', 'acu-1', 'algo pasó'),
    ).rejects.toThrow(/acu-1/);
  });
});

describe('agreements.backed-service — addressed by acuerdo', () => {
  it('reads the state by id and takes the caso from the bundle', async () => {
    const getById = jest.fn().mockResolvedValue({ acuerdo: acuerdo('enviado_a_firma'), firmas: [] });
    const getCaseTitle = jest.fn().mockResolvedValue('Custodia');
    const api = fakeApi({ getById });

    const state = await createBackedAgreementsService(api, { ...deps, getCaseTitle }).getAgreementStateById('acu-1');

    expect(getById).toHaveBeenCalledWith('acu-1');
    expect(getCaseTitle).toHaveBeenCalledWith('caso-1');
    expect(state?.agreement.id).toBe('acu-1');
    expect(api.getForCase).not.toHaveBeenCalled();
  });

  it('answers null, not an error, for an id that is not there', async () => {
    const api = fakeApi({ getById: jest.fn().mockResolvedValue(null) });

    await expect(createBackedAgreementsService(api, deps).getAgreementStateById('acu-9')).resolves.toBeNull();
  });

  it('re-reads by id after signing, never by caso', async () => {
    const getForCase = jest.fn();
    const api = fakeApi({ getForCase });

    await createBackedAgreementsService(api, deps).submitOwnMockSignature('caso-1', 'acu-1');

    expect(api.sendToSignature).toHaveBeenCalledWith('acu-1');
    expect(api.getById).toHaveBeenCalledWith('acu-1');
    expect(getForCase).not.toHaveBeenCalled();
  });

  it('sends a known draft to signature as it is — it never regenerates it', async () => {
    // After a renegociación the next draft already exists server-side, and
    // POST /casos/:id/acuerdo would answer 409 acuerdo_already_exists for it.
    const getById = jest
      .fn()
      .mockResolvedValueOnce({ acuerdo: acuerdo('borrador'), firmas: [] })
      .mockResolvedValueOnce({ acuerdo: acuerdo('enviado_a_firma'), firmas: [] });
    const api = fakeApi({ getById });

    const state = await createBackedAgreementsService(api, deps).prepareSignatureDocument('caso-1', 'acu-1');

    expect(api.generate).not.toHaveBeenCalled();
    expect(api.getForCase).not.toHaveBeenCalled();
    expect(api.sendToSignature).toHaveBeenCalledWith('acu-1');
    expect(state.agreement.estado).toBe('enviado_a_firma');
  });

  it('without an id still generates when the caso has none, then reads the new one by id', async () => {
    const api = fakeApi({
      getForCase: jest.fn().mockResolvedValue(null),
      generate: jest.fn().mockResolvedValue({ ...acuerdo('borrador'), id: 'acu-new' }),
      getById: jest.fn().mockResolvedValue({ acuerdo: { ...acuerdo('enviado_a_firma'), id: 'acu-new' }, firmas: [] }),
    });

    const state = await createBackedAgreementsService(api, deps).prepareSignatureDocument('caso-1');

    expect(api.generate).toHaveBeenCalledWith('caso-1');
    expect(api.sendToSignature).toHaveBeenCalledWith('acu-new');
    expect(api.getById).toHaveBeenCalledWith('acu-new');
    expect(state.agreement.id).toBe('acu-new');
  });

  it('derives the history from the acuerdo the id names', async () => {
    const getById = jest.fn().mockResolvedValue({ acuerdo: acuerdo('borrador'), firmas: [] });
    const api = fakeApi({ getById });

    const items = await createBackedAgreementsService(api, deps).getAgreementHistory('caso-1', 'acu-1');

    expect(getById).toHaveBeenCalledWith('acu-1');
    expect(api.getForCase).not.toHaveBeenCalled();
    expect(items.map((item) => item.eventKey)).toEqual(['agreement_created']);
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
