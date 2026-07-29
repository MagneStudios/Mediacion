import { assertNotServiceRoleKey, isApiConfigured, readAppEnv } from '../env';

function encodeJwt(payload: Record<string, unknown>): string {
  const body = globalThis.btoa(JSON.stringify(payload));
  return `header.${body}.signature`;
}

const anonKey = encodeJwt({ iss: 'supabase', role: 'anon' });
const serviceRoleKey = encodeJwt({ iss: 'supabase', role: 'service_role' });

const validEnv = {
  EXPO_PUBLIC_SUPABASE_URL: 'http://supabase.example',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  EXPO_PUBLIC_API_URL: 'http://api.example',
};

describe('readAppEnv', () => {
  it('reads the three published values', () => {
    expect(readAppEnv(validEnv)).toEqual({
      supabaseUrl: 'http://supabase.example',
      supabaseAnonKey: anonKey,
      apiBaseUrl: 'http://api.example',
    });
  });

  it('strips a trailing slash so joined paths never double up', () => {
    const env = readAppEnv({
      ...validEnv,
      EXPO_PUBLIC_API_URL: 'http://api.example/',
      EXPO_PUBLIC_SUPABASE_URL: 'http://supabase.example///',
    });

    expect(env.apiBaseUrl).toBe('http://api.example');
    expect(env.supabaseUrl).toBe('http://supabase.example');
  });

  it.each([
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_API_URL',
  ])('throws when %s is missing', (name) => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env[name];

    expect(() => readAppEnv(env)).toThrow(name);
  });

  it('throws when a value is only whitespace', () => {
    expect(() => readAppEnv({ ...validEnv, EXPO_PUBLIC_API_URL: '   ' })).toThrow(
      'EXPO_PUBLIC_API_URL',
    );
  });
});

describe('assertNotServiceRoleKey', () => {
  it('rejects a service_role key, which would bypass RLS for every caller', () => {
    expect(() => assertNotServiceRoleKey(serviceRoleKey)).toThrow('service_role');
  });

  it('accepts an anon key', () => {
    expect(() => assertNotServiceRoleKey(anonKey)).not.toThrow();
  });

  it('accepts an opaque non-jwt value rather than guessing', () => {
    expect(() => assertNotServiceRoleKey('sb_publishable_abc123')).not.toThrow();
  });

  it('is reached through readAppEnv, so a misconfigured bundle fails at startup', () => {
    expect(() =>
      readAppEnv({ ...validEnv, EXPO_PUBLIC_SUPABASE_ANON_KEY: serviceRoleKey }),
    ).toThrow('service_role');
  });
});

describe('isApiConfigured', () => {
  it('is true once every value is present', () => {
    expect(isApiConfigured(validEnv)).toBe(true);
  });

  it('is false when nothing is configured, so the app can stay on mocks', () => {
    expect(isApiConfigured({})).toBe(false);
  });

  it('is false when only part of the configuration is present', () => {
    expect(isApiConfigured({ EXPO_PUBLIC_API_URL: 'http://api.example' })).toBe(false);
  });
});
