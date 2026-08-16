import { mockLegalDocuments } from '../../mocks/legal';
import {
  __mockForceLegalFailure,
  __resetMockLegalState,
  createMockLegalService,
} from '../legal.service';

describe('legal.service — TyC acceptance module', () => {
  beforeEach(() => {
    __resetMockLegalState();
  });

  it('serves the current (validTo null) version of each document, with the real Golosetti text', async () => {
    const service = createMockLegalService();
    const terms = await service.getCurrentDocument('terms');
    const privacy = await service.getCurrentDocument('privacy');

    expect(terms).toEqual(expect.objectContaining({ tipo: 'terms', version: 'v1.0', validTo: null }));
    expect(privacy).toEqual(expect.objectContaining({ tipo: 'privacy', version: 'v1.0', validTo: null }));
    // The wording comes from the data, and the [COMPLETAR] placeholders stay
    // visible — they are Administración's pending inputs, not ours to hide.
    expect(terms?.contenido).toContain('COMPLETAR');
    expect(privacy?.contenido).toContain('COMPLETAR');
  });

  it('the visible last-updated date comes from the document data, not from any component', async () => {
    const service = createMockLegalService();
    const terms = await service.getCurrentDocument('terms');
    expect(terms?.validFrom).toBe(mockLegalDocuments[0].validFrom);
  });

  it('starts with both documents pending acceptance', async () => {
    const service = createMockLegalService();
    await expect(service.getAcceptanceStatus()).resolves.toEqual({
      pendientes: expect.arrayContaining(['terms', 'privacy']),
      requiereReaceptacion: false,
    });
  });

  it('registering an acceptance clears the pending list', async () => {
    const service = createMockLegalService();
    await service.registerAcceptance({ marketing: false });
    await expect(service.getAcceptanceStatus()).resolves.toEqual({
      pendientes: [],
      requiereReaceptacion: false,
    });
  });

  it('a marketing "no" is a valid acceptance — it never blocks', async () => {
    const service = createMockLegalService();
    await expect(service.registerAcceptance({ marketing: false })).resolves.toBeUndefined();
  });

  it('withdrawal requests get a tracking id and a server-side timestamp', async () => {
    const service = createMockLegalService();
    const receipt = await service.requestWithdrawal({
      nombre: 'Ana Pérez',
      email: 'ana@example.com',
      detalle: 'Plan estudio, contratado el 10/08',
    });
    expect(receipt.id).toMatch(/^arr-\d{4}$/);
    expect(new Date(receipt.receivedAt).getTime()).not.toBeNaN();
  });

  it('rejects a withdrawal request with missing fields', async () => {
    const service = createMockLegalService();
    await expect(
      service.requestWithdrawal({ nombre: '  ', email: 'ana@example.com', detalle: 'x' }),
    ).rejects.toThrow('withdrawal_missing_fields');
  });

  it('surfaces forced failures as rejections (recoverable-error path)', async () => {
    const service = createMockLegalService();
    __mockForceLegalFailure('getCurrentDocument');
    await expect(service.getCurrentDocument('terms')).rejects.toThrow('mock_get_legal_document_failed');
    // One-shot: the next call succeeds again.
    await expect(service.getCurrentDocument('terms')).resolves.toBeDefined();
  });

  it('company info still reports the pending datos societarios', async () => {
    const service = createMockLegalService();
    const info = await service.getCompanyInfo();
    // These stay null until Administración provides them — a non-null value
    // here without a real source would be invented data.
    expect(info.razonSocial).toBeNull();
    expect(info.cuit).toBeNull();
    expect(info.plazoRespuestaDias).toBeGreaterThan(0);
  });
});
