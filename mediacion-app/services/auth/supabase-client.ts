import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readAppEnv } from '@/config/env';
import { expoPublicEnv } from '@/config/env-source';

/**
 * Supabase is used for authentication only: the app never reads or writes
 * tables directly. Every domain read goes through `apps/api`, which owns the
 * RN-01 isolation rules that RLS alone does not express.
 */
let client: SupabaseClient | null = null;

/**
 * The default source is `expoPublicEnv`, not `process.env`. Expo only inlines
 * `process.env.NAME` written as a static member expression, so handing the whole
 * object over means `readAppEnv` finds nothing in a web bundle — and the failure
 * is silent: the app falls back to mocks and looks fine. See config/env-source.ts.
 */
export function createSupabaseClient(
  source: Record<string, string | undefined> = expoPublicEnv,
): SupabaseClient {
  const env = readAppEnv(source);
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar to read a callback fragment from.
      detectSessionInUrl: false,
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (client === null) {
    client = createSupabaseClient();
  }
  return client;
}

/** Test seam: lets a suite install a double without reaching into module state. */
export function __setSupabaseClient(next: SupabaseClient | null): void {
  client = next;
}
