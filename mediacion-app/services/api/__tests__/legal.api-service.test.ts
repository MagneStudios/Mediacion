import { createApiLegalService, toAcceptanceStatus, toLegalDocument } from '../legal.api-service';
import type { HttpClient, RequestOptions } from '../http-client';

/** Records every request and replays canned responses — no network. */
function fakeHttp(responses: Record<string, unknown>) {
  const calls: Array<{ path: string; options?: RequestOptions }> = [];
  const http: HttpClient = {
    async request<T>(path: string, options?: RequestOptions): Promise<T> {
      calls.push({ path, options });
      return responses[path] as T;
    },
  };
  return { http, calls };
}

describe('legal.api-service — frozen /legal/* contract', () => {
  it('maps the snake_case legal_documents row to the domain shape', () => {
    expect(
      toLegalDocument({
        tipo: 'terms',
        version: 'v1.1',
        contenido: 'texto',
        valid_from: '2026-09-01T00:00:00Z',
        valid_to: null,
        is_substantial: true,
        resumen_cambios: 'Cambió la cláusula N',
      }),
    ).toEqual({
      tipo: 'terms',
      version: 'v1.1',
      contenido: 'texto',
      validFrom: '2026-09-01T00:00:00Z',
      validTo: null,
      isSubstantial: true,
      resumenCambios: 'Cambió la cláusula N',
    });
  });

  it('maps the acceptance status', () => {
    expect(toAcceptanceStatus({ pendientes: ['terms'], requiere_reaceptacion: true })).toEqual({
      pendientes: ['terms'],
      requiereReaceptacion: true,
    });
  });

  it('registerAcceptance sends ONLY the marketing opt-in — never IP, UA or version', async () => {
    const { http, calls } = fakeHttp({ '/legal/aceptaciones': undefined });
    await createApiLegalService(http).registerAcceptance({ marketing: true });

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/legal/aceptaciones');
    expect(calls[0].options?.method).toBe('POST');
    // The exact body, asserted with toEqual so any extra field —
    // a client-supplied ip, userAgent or version would make the record
    // forgeable (instructivo error #3) — fails this test.
    expect(calls[0].options?.body).toEqual({ marketing: true });
  });

  it('requestWithdrawal posts the public form and maps the receipt', async () => {
    const { http, calls } = fakeHttp({
      '/legal/arrepentimiento': { id: 'arr-1', received_at: '2026-08-14T12:00:00Z' },
    });
    const receipt = await createApiLegalService(http).requestWithdrawal({
      nombre: 'Ana',
      email: 'ana@example.com',
      detalle: 'Plan estudio',
    });

    expect(calls[0].options?.body).toEqual({ nombre: 'Ana', email: 'ana@example.com', detalle: 'Plan estudio' });
    expect(receipt).toEqual({ id: 'arr-1', receivedAt: '2026-08-14T12:00:00Z' });
  });

  it('getCurrentDocument hits the per-type endpoint', async () => {
    const row = {
      tipo: 'privacy',
      version: 'v1.0',
      contenido: 'texto',
      valid_from: '2026-08-13T00:00:00Z',
      valid_to: null,
      is_substantial: false,
      resumen_cambios: null,
    };
    const { http, calls } = fakeHttp({ '/legal/documentos/privacy': row });
    const document = await createApiLegalService(http).getCurrentDocument('privacy');

    expect(calls[0].path).toBe('/legal/documentos/privacy');
    expect(document.tipo).toBe('privacy');
  });
});
