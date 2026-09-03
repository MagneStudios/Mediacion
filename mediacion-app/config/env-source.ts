import type { EnvSource } from './env';

/**
 * The published configuration, read the one way Expo can actually inline.
 *
 * Expo replaces an environment variable only where it appears as a static
 * `process.env.NAME` member expression:
 *
 *   "Every environment variable must be statically referenced as a property of
 *    process.env using JavaScript's dot notation for it to be inlined."
 *   "Alternative versions of the expression are not supported. For example,
 *    process.env['EXPO_PUBLIC_KEY'] or const {EXPO_PUBLIC_X} = process.env is
 *    invalid and will not be inlined."
 *   — https://docs.expo.dev/guides/environment-variables/
 *
 * So `process.env` cannot be handed around as an object: by the time something
 * reads `source[name]` in a web bundle there is nothing there to read. That is
 * not a loud failure — `isApiConfigured` simply returns false and the app runs
 * on mocks, looking entirely healthy while never reaching the backend.
 *
 * This module is the single place allowed to touch `process.env`. Anything
 * needing configuration takes an `EnvSource` and receives this.
 */
export const expoPublicEnv: EnvSource = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_ESTUDIO_WHATSAPP: process.env.EXPO_PUBLIC_ESTUDIO_WHATSAPP,
};
