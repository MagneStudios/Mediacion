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
});
