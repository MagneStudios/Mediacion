import { createBackend } from '../backend';

function encodeJwt(payload: Record<string, unknown>): string {
  return `header.${globalThis.btoa(JSON.stringify(payload))}.signature`;
}

const anonKey = encodeJwt({ iss: 'supabase', role: 'anon' });

const configured = {
  EXPO_PUBLIC_SUPABASE_URL: 'http://supabase.example',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  EXPO_PUBLIC_API_URL: 'http://api.example',
};

describe('createBackend', () => {
  it('returns null when nothing is configured, so callers stay on mocks', () => {
    expect(createBackend({})).toBeNull();
  });

  it('returns null when only part of the configuration is present', () => {
    expect(
      createBackend({ EXPO_PUBLIC_API_URL: 'http://api.example' }),
    ).toBeNull();
  });

  it('builds the stack when fully configured', () => {
    const backend = createBackend(configured, {
      createClient: () => ({ auth: {} }) as never,
    });
    expect(backend).not.toBeNull();
    expect(backend?.cases.listCases).toBeInstanceOf(Function);
    expect(backend?.positions.getOwnPositions).toBeInstanceOf(Function);
    expect(backend?.profile.getProfile).toBeInstanceOf(Function);
    expect(backend?.plans.listPlanes).toBeInstanceOf(Function);
    expect(backend?.auth.signIn).toBeInstanceOf(Function);
  });

  it('never throws on a service_role key — it refuses to build at all', () => {
    const serviceRole = encodeJwt({ iss: 'supabase', role: 'service_role' });
    expect(
      createBackend({ ...configured, EXPO_PUBLIC_SUPABASE_ANON_KEY: serviceRole }),
    ).toBeNull();
  });

  it('asks the auth service for a token on every request rather than capturing one', async () => {
    const tokens = ['first', 'second'];
    const fetchImpl = jest.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response('[]', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const backend = createBackend(configured, {
      createClient: () => ({ auth: {} }) as never,
      authService: {
        getAccessToken: async () => tokens.shift() ?? null,
        getSession: async () => null,
        signIn: async () => {
          throw new Error('unused');
        },
        signUp: async () => null,
        signOut: async () => undefined,
        onSessionChange: () => () => undefined,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await backend?.cases.listCases();
    await backend?.cases.listCases();

    const headersOf = (call: number) =>
      fetchImpl.mock.calls[call]?.[1]?.headers as Record<string, string> | undefined;
    expect(headersOf(0)?.Authorization).toBe('Bearer first');
    expect(headersOf(1)?.Authorization).toBe('Bearer second');
  });

  it('reads the plan catalog from the configured host, authenticated, and parses the wire row', async () => {
    // End to end through the real http client rather than a fake one: the URL
    // it builds and the bearer it attaches are as much of the integration as
    // the mapper is. `GET /planes` is Bearer-gated on the API
    // (`planes.controller.ts` carries no `@Public`), so an unauthenticated
    // read would 401 in production and pass a mapper-only test.
    const body = JSON.stringify([
      {
        id: 'plan-estudio',
        nombre: 'estudio',
        limite_carpetas: 0,
        limite_casos: null,
        limite_iteraciones_ia: 0,
        // As `pg` sends numeric: a string, not a number.
        precio: '25.00',
        moneda: 'ARS',
      },
    ]);
    const fetchImpl = jest.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const backend = createBackend(configured, {
      createClient: () => ({ auth: {} }) as never,
      authService: {
        getAccessToken: async () => 'token',
        getSession: async () => null,
        signIn: async () => {
          throw new Error('unused');
        },
        signUp: async () => null,
        signOut: async () => undefined,
        onSessionChange: () => () => undefined,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const plans = await backend?.plans.listPlanes();

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.example/planes');
    expect(
      (fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>)?.Authorization,
    ).toBe('Bearer token');
    expect(plans).toEqual([
      {
        id: 'plan-estudio',
        nombre: 'estudio',
        limiteCarpetas: 0,
        limiteCasos: null,
        limiteIteracionesIa: 0,
        precio: 25,
        moneda: 'ARS',
      },
    ]);
  });
});
