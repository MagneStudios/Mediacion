import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readAppEnv } from '@/config/env';

/**
 * Supabase is used for authentication only: the app never reads or writes
 * tables directly. Every domain read goes through `apps/api`, which owns the
 * RN-01 isolation rules that RLS alone does not express.
 */
let client: SupabaseClient | null = null;

export function createSupabaseClient(
  source: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
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
