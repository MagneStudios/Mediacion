import { createApiNegotiationService } from '../negotiation.api-service';
import type { HttpClient, RequestOptions } from '../http-client';

type Call = { path: string; options?: RequestOptions };

/** Records every request and replays canned responses — no network. */
function fakeHttp(responses: Record<string, unknown>) {
  const calls: Call[] = [];
  const http: HttpClient = {
    async request<T>(path: string, options?: RequestOptions): Promise<T> {
      calls.push({ path, options });
      return responses[path] as T;
    },
    async requestText(): Promise<string> {
      return '';
    },
  };
  return { http, calls };
}

describe('negotiation.api-service — negociaciones', () => {
  it('lists the negociaciones of a caso', async () => {
    const { http, calls } = fakeHttp({ '/casos/caso-1/negociaciones': [] });

    await expect(createApiNegotiationService(http).listNegociaciones('caso-1')).resolves.toEqual([]);
    expect(calls).toEqual([{ path: '/casos/caso-1/negociaciones', options: undefined }]);
  });

  it('answers an empty list as an empty list — a caso with none is not a failure', async () => {
    // The API answers `[]`, not 404, so there is nothing to swallow and a
    // fresh caso renders as "no materias yet" rather than as an error.
    const { http } = fakeHttp({ '/casos/caso-1/negociaciones': [] });

    await expect(createApiNegotiationService(http).listNegociaciones('caso-1')).resolves.toEqual([]);
  });

  it('renegotiates with a body-less POST and hands back the two ids untouched', async () => {
    const view = { negotiation_id: 'neg-1', agreement_id: 'acu-2' };
    const { http, calls } = fakeHttp({ '/negociaciones/neg-1/renegociar': view });

    await expect(createApiNegotiationService(http).renegociar('neg-1')).resolves.toEqual(view);
    expect(calls).toEqual([{ path: '/negociaciones/neg-1/renegociar', options: { method: 'POST' } }]);
  });

  it('opens a negociación with the materia in the body, never the método', async () => {
    const row = {
      id: 'neg-2',
      caso_id: 'caso-1',
      subject_type: 'alimentos',
      metodo: 'mediacion',
      estado: 'borrador',
      ronda_actual: 0,
      acuerdo_vigente: null,
      created_at: '2026-09-10T00:00:00.000Z',
    };
    const { http, calls } = fakeHttp({ '/casos/caso-1/negociaciones': row });

    await expect(createApiNegotiationService(http).crearNegociacion('caso-1', 'alimentos')).resolves.toEqual(row);
    expect(calls).toEqual([
      { path: '/casos/caso-1/negociaciones', options: { method: 'POST', body: { subject_type: 'alimentos' } } },
    ]);
  });

  it('lists the propuestas of one negociación, not the caso', async () => {
    const { http, calls } = fakeHttp({ '/negociaciones/neg-1/propuestas': [] });

    await expect(createApiNegotiationService(http).listPropuestasForNegociacion('neg-1')).resolves.toEqual([]);
    expect(calls).toEqual([{ path: '/negociaciones/neg-1/propuestas', options: undefined }]);
  });

  it('generates a propuesta for one negociación with a body-less POST', async () => {
    const view = { id: 'prop-1' };
    const { http, calls } = fakeHttp({ '/negociaciones/neg-1/propuestas': view });

    await expect(createApiNegotiationService(http).generatePropuestaForNegociacion('neg-1')).resolves.toEqual(view);
    expect(calls).toEqual([{ path: '/negociaciones/neg-1/propuestas', options: { method: 'POST' } }]);
  });
});
