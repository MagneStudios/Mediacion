import { ApiError, codeSolicitudAbogadoNotFound } from '../api-error';
import type { HttpClient, RequestOptions } from '../http-client';
import {
  createApiLawyerService,
  toLawyerRequest,
  type ApiSolicitudAbogadoView,
} from '../lawyer.api-service';

/** Records every request and replays canned responses — no network. */
function fakeHttp(responses: Record<string, unknown>) {
  const calls: { path: string; options?: RequestOptions }[] = [];
  const http: HttpClient = {
    async request<T>(path: string, options?: RequestOptions): Promise<T> {
      calls.push({ path, options });
      const value = responses[path];
      if (value instanceof Error) throw value;
      return value as T;
    },
    async requestText(): Promise<string> {
      throw new Error('requestText is not stubbed in this suite');
    },
  };
  return { http, calls };
}

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

describe('lawyer.api-service', () => {
  it('composes the domain fee from moneda + monto_minor, and never invents a handoff', () => {
    expect(toLawyerRequest(row())).toEqual({
      id: 'lawreq-0001',
      casoId: 'caso-1',
      estado: 'pendiente_pago',
      fee: { currency: 'ARS', amountMinor: 5_000_000 },
      createdAt: '2026-09-03T12:00:00.000Z',
      handoff: null,
    });
  });

  it('passes the wire status through untouched — it does not derive the four states BE cannot emit', () => {
    expect(toLawyerRequest(row({ status: 'pagada' })).estado).toBe('pagada');
    expect(toLawyerRequest(row({ status: 'fallida' })).estado).toBe('fallida');
  });

  it('reads the request with a plain GET', async () => {
    const { http, calls } = fakeHttp({ '/casos/caso-1/solicitud-abogado': row() });

    await createApiLawyerService(http).getRequest('caso-1');

    expect(calls).toEqual([{ path: '/casos/caso-1/solicitud-abogado', options: undefined }]);
  });

  it('maps solicitud_abogado_not_found to null — "this case never asked for a lawyer"', async () => {
    const notFound = new ApiError(codeSolicitudAbogadoNotFound, 'No lawyer request for this case', 404);
    const { http } = fakeHttp({ '/casos/caso-1/solicitud-abogado': notFound });

    await expect(createApiLawyerService(http).getRequest('caso-1')).resolves.toBeNull();
  });

  it('propagates any other failure so the screen can offer a retry', async () => {
    const { http } = fakeHttp({
      '/casos/caso-1/solicitud-abogado': new ApiError('network_unavailable', 'down', 0),
    });

    await expect(createApiLawyerService(http).getRequest('caso-1')).rejects.toThrow('down');
  });

  it('opens the checkout with a POST and answers the raw checkout shape', async () => {
    const checkout = { solicitud: row(), init_point: 'https://mp/checkout/1' };
    const { http, calls } = fakeHttp({ '/casos/caso-1/solicitud-abogado': checkout });

    await expect(createApiLawyerService(http).requestLawyer('caso-1')).resolves.toEqual(checkout);
    expect(calls).toEqual([
      { path: '/casos/caso-1/solicitud-abogado', options: { method: 'POST' } },
    ]);
  });
});
