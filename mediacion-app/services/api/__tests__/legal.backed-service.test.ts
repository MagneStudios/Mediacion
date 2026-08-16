import type { LegalDocument } from '@/types/legal';

import { ApiError, codeLegalDocumentNotFound } from '../api-error';
import type { ApiLegalService } from '../legal.api-service';
import { createBackedLegalService } from '../legal.backed-service';

const terms: LegalDocument = {
  tipo: 'terms',
  version: 'v1.0',
  contenido: '## A. DEFINICIONES\n\nA.1. Texto.',
  validFrom: '2026-08-14T17:00:00.000Z',
  validTo: null,
  isSubstantial: false,
  resumenCambios: null,
};

function fakeApi(overrides: Partial<ApiLegalService> = {}): ApiLegalService {
  return {
    getCurrentDocument: jest.fn().mockResolvedValue(terms),
    registerAcceptance: jest.fn().mockResolvedValue(undefined),
    getAcceptanceStatus: jest.fn().mockResolvedValue({ pendientes: [], requiereReaceptacion: false }),
    requestWithdrawal: jest.fn().mockResolvedValue({ id: 'ARR-0001', receivedAt: '2026-08-16T12:00:00.000Z' }),
    requestContact: jest.fn().mockResolvedValue({ id: 'CON-0001', receivedAt: '2026-08-16T12:00:00.000Z' }),
    ...overrides,
  };
}

describe('legal.backed-service', () => {
  it('passes the current document through', async () => {
    const service = createBackedLegalService(fakeApi());
    await expect(service.getCurrentDocument('terms')).resolves.toEqual(terms);
  });

  it('maps legal_document_not_found to undefined — the page shows its empty state, not an error', async () => {
    const api = fakeApi({
      getCurrentDocument: jest
        .fn()
        .mockRejectedValue(new ApiError(codeLegalDocumentNotFound, 'Legal document not found', 404)),
    });
    await expect(createBackedLegalService(api).getCurrentDocument('terms')).resolves.toBeUndefined();
  });

  it('still propagates any other failure so the screen can offer a retry', async () => {
    const api = fakeApi({
      getCurrentDocument: jest.fn().mockRejectedValue(new ApiError('network_unavailable', 'down', 0)),
    });
    await expect(createBackedLegalService(api).getCurrentDocument('terms')).rejects.toThrow('down');
  });

  it('forwards the acceptance untouched — including an absent marketing key', async () => {
    const registerAcceptance = jest.fn().mockResolvedValue(undefined);
    const service = createBackedLegalService(fakeApi({ registerAcceptance }));

    await service.registerAcceptance({ marketing: true });
    expect(registerAcceptance).toHaveBeenCalledWith({ marketing: true });

    // Re-acceptance: no marketing field, so the server does not rewrite the
    // choice made at signup.
    await service.registerAcceptance({});
    expect(registerAcceptance).toHaveBeenLastCalledWith({});
  });

  it('forwards the contact request to the public endpoint', async () => {
    const requestContact = jest
      .fn()
      .mockResolvedValue({ id: 'CON-0007', receivedAt: '2026-08-16T12:00:00.000Z' });
    const input = { nombre: 'Ana', email: 'ana@example.com', mensaje: 'Consulta' };

    await expect(createBackedLegalService(fakeApi({ requestContact })).requestContact(input)).resolves.toEqual(
      { id: 'CON-0007', receivedAt: '2026-08-16T12:00:00.000Z' },
    );
    expect(requestContact).toHaveBeenCalledWith(input);
  });

  it('serves the pending company info locally — there is no endpoint, and no invented data', async () => {
    const info = await createBackedLegalService(fakeApi()).getCompanyInfo();
    expect(info.razonSocial).toBeNull();
    expect(info.cuit).toBeNull();
    expect(info.domicilio).toBeNull();
  });
});
