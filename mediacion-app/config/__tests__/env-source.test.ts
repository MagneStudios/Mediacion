/**
 * These tests exist because the failure they guard against is invisible at
 * runtime. Expo inlines an environment variable only when it is written as a
 * static `process.env.NAME` member expression:
 *
 *   "Every environment variable must be statically referenced as a property of
 *    process.env using JavaScript's dot notation for it to be inlined."
 *   "Alternative versions of the expression are not supported. For example,
 *    process.env['EXPO_PUBLIC_KEY'] or const {EXPO_PUBLIC_X} = process.env is
 *    invalid and will not be inlined."
 *   — https://docs.expo.dev/guides/environment-variables/
 *
 * Passing `process.env` by reference (the previous default in
 * services/auth/supabase-client.ts) therefore yields an object with none of the
 * values in a web bundle. The app then falls back to mocks and looks perfectly
 * healthy while never contacting the backend.
 */

function loadSource() {
  let mod: typeof import('../env-source');
  jest.isolateModules(() => {
    mod = require('../env-source') as typeof import('../env-source');
  });
  // biome-ignore lint/style/noNonNullAssertion: assigned synchronously above.
  return mod!;
}

const names = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_URL',
  // Número del estudio para el handoff por WhatsApp (spec §7.5). Publicable:
  // es el teléfono comercial que el estudio quiere que la gente use.
  'EXPO_PUBLIC_ESTUDIO_WHATSAPP',
] as const;

describe('expoPublicEnv', () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of names) {
      original[name] = process.env[name];
    }
  });

  afterEach(() => {
    for (const name of names) {
      if (original[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = original[name];
      }
    }
  });

  it('exposes each published value read from process.env', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://supabase.example';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.EXPO_PUBLIC_API_URL = 'http://api.example';

    expect(loadSource().expoPublicEnv).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: 'http://supabase.example',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      EXPO_PUBLIC_API_URL: 'http://api.example',
    });
  });

  it('carries exactly the published names and nothing else', () => {
    expect(Object.keys(loadSource().expoPublicEnv).sort()).toEqual([...names].sort());
  });

  it('leaves a missing value undefined rather than inventing one', () => {
    for (const name of names) {
      delete process.env[name];
    }
    const { expoPublicEnv } = loadSource();
    expect(expoPublicEnv.EXPO_PUBLIC_API_URL).toBeUndefined();
    expect(expoPublicEnv.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(expoPublicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
  });

  it('is written with dot notation only, which is what makes inlining work', () => {
    // Reading the source is the only way to assert this: bracket notation and
    // destructuring both behave identically under Jest, where process.env is a
    // real object, and only diverge once Metro compiles the bundle.
    const src = require('node:fs').readFileSync(
      require.resolve('../env-source.ts'),
      'utf8',
    ) as string;
    const body = src.slice(src.indexOf('export const expoPublicEnv'));
    expect(body).not.toMatch(/process\.env\s*\[/);
    expect(body).not.toMatch(/const\s*\{[^}]*\}\s*=\s*process\.env/);
    for (const name of names) {
      expect(body).toContain(`process.env.${name}`);
    }
  });
});
