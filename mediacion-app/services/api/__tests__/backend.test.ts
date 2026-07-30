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
});
