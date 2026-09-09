import { ApiError, codeNetworkUnavailable } from '../api-error';
import { createHttpClient } from '../http-client';

type FetchCall = { url: string; init: RequestInit };

function stubFetch(
  responder: (call: FetchCall) => Response | Promise<Response> | never,
): { calls: FetchCall[]; impl: typeof fetch } {
  const calls: FetchCall[] = [];
  const impl = ((url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return Promise.resolve(responder(call));
  }) as unknown as typeof fetch;
  return { calls, impl };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildClient(
  responder: (call: FetchCall) => Response | Promise<Response>,
  getToken = () => Promise.resolve<string | null>('token-abc'),
) {
  const { calls, impl } = stubFetch(responder);
  return {
    calls,
    client: createHttpClient({
      baseUrl: 'http://api.example',
      getToken,
      fetchImpl: impl,
    }),
  };
}

describe('createHttpClient', () => {
  it('returns the parsed json body on success', async () => {
    const { client } = buildClient(() => jsonResponse([{ id: 'caso-1' }]));

    await expect(client.request('/casos')).resolves.toEqual([{ id: 'caso-1' }]);
  });

  it('sends the bearer token resolved at request time', async () => {
    const { client, calls } = buildClient(() => jsonResponse({}));

    await client.request('/me');

    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      'Bearer token-abc',
    );
  });

  it('asks for a fresh token on every request, so a refreshed session is honored', async () => {
    const tokens = ['first', 'second'];
    const getToken = jest.fn(() => Promise.resolve(tokens.shift() ?? null));
    const { client, calls } = buildClient(() => jsonResponse({}), getToken);

    await client.request('/me');
    await client.request('/me');

    expect(getToken).toHaveBeenCalledTimes(2);
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe(
      'Bearer second',
    );
  });

  it('omits the Authorization header entirely when signed out', async () => {
    const { client, calls } = buildClient(() => jsonResponse({}), () =>
      Promise.resolve(null),
    );

    await client.request('/health');

    expect(calls[0].init.headers as Record<string, string>).not.toHaveProperty(
      'Authorization',
    );
  });

  it('joins base url and path without doubling the slash', async () => {
    const { client, calls } = buildClient(() => jsonResponse({}));

    await client.request('/casos');

    expect(calls[0].url).toBe('http://api.example/casos');
  });

  it('serializes the body and sets the json content type', async () => {
    const { client, calls } = buildClient(() => jsonResponse({}));

    await client.request('/casos', { method: 'POST', body: { nombre: 'Divorcio' } });

    expect(calls[0].init.body).toBe('{"nombre":"Divorcio"}');
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('maps the error envelope onto an ApiError carrying code and status', async () => {
    const { client } = buildClient(() =>
      jsonResponse({ error: { code: 'caso_not_found', message: 'Case not found' } }, 404),
    );

    let thrown: unknown;
    try {
      await client.request('/casos/x');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe('caso_not_found');
    expect((thrown as ApiError).status).toBe(404);
  });

  it('falls back to internal_error when a proxy answers with non-json', async () => {
    const { client } = buildClient(
      () => new Response('<html>502</html>', { status: 502 }),
    );

    let thrown: unknown;
    try {
      await client.request('/casos');
    } catch (error) {
      thrown = error;
    }

    expect((thrown as ApiError).code).toBe('internal_error');
    expect((thrown as ApiError).status).toBe(502);
  });

  it('reports a transport failure as network_unavailable, not as an api contract error', async () => {
    const { client } = buildClient(() => {
      throw new TypeError('Network request failed');
    });

    let thrown: unknown;
    try {
      await client.request('/casos');
    } catch (error) {
      thrown = error;
    }

    expect((thrown as ApiError).code).toBe(codeNetworkUnavailable);
  });

  it('resolves to undefined for a 204, which DELETE returns', async () => {
    const { client } = buildClient(() => new Response(null, { status: 204 }));

    await expect(
      client.request('/items/item-1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  describe('requestText', () => {
    const document = 'ACUERDO DE MEDIACIÓN\n\nIdentificador: acu-1\n';

    function textResponse(body: string, status = 200): Response {
      return new Response(body, {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    it('returns the body verbatim instead of trying to parse it as json', async () => {
      // `request` would answer `undefined` here: the JSON parse fails and the
      // body is dropped. That is the whole reason this door exists.
      const { client } = buildClient(() => textResponse(document));

      await expect(client.requestText('/acuerdos/acu-1/exportar')).resolves.toBe(
        document,
      );
    });

    it('asks for text rather than json, and still authenticates', async () => {
      const { client, calls } = buildClient(() => textResponse(document));

      await client.requestText('/acuerdos/acu-1/exportar');

      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers.Accept).toBe('text/plain');
      expect(headers.Authorization).toBe('Bearer token-abc');
    });

    it('still reads a failure as the json envelope every other route uses', async () => {
      // The exception filter answers before the text handler ever runs, so a
      // 404 here is JSON even though the success body would not be.
      const { client } = buildClient(() =>
        jsonResponse({ error: { code: 'acuerdo_not_found', message: 'gone' } }, 404),
      );

      const thrown = await client
        .requestText('/acuerdos/acu-1/exportar')
        .catch((error: unknown) => error);

      expect(thrown).toBeInstanceOf(ApiError);
      expect((thrown as ApiError).code).toBe('acuerdo_not_found');
      expect((thrown as ApiError).status).toBe(404);
    });

    it('reports a transport failure the same way the json reader does', async () => {
      const { client } = buildClient(() => {
        throw new Error('socket hang up');
      });

      const thrown = await client
        .requestText('/acuerdos/acu-1/exportar')
        .catch((error: unknown) => error);

      expect((thrown as ApiError).code).toBe(codeNetworkUnavailable);
    });

    it('answers an empty document as an empty string, not as undefined', async () => {
      const { client } = buildClient(() => textResponse(''));

      await expect(client.requestText('/acuerdos/acu-1/exportar')).resolves.toBe('');
    });
  });
});
