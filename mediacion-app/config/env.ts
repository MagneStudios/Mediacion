/**
 * Runtime configuration for the API and Supabase boundaries.
 *
 * Every value comes from `EXPO_PUBLIC_*`, which Expo inlines into the client
 * bundle — so only publishable values belong here. The Supabase *anon* key is
 * publishable by design; the service-role key must never appear in this app.
 */
export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
};

export type EnvSource = Record<string, string | undefined>;

const serviceRoleMarker = '"role":"service_role"';

function decodeJwtPayload(token: string): string | null {
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }
  try {
    return globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
}

/**
 * A service-role key in a client bundle grants every caller full read/write on
 * every table, bypassing RLS. Failing loudly at startup is the only safe
 * response — a warning would ship.
 */
export function assertNotServiceRoleKey(key: string): void {
  const payload = decodeJwtPayload(key);
  if (payload !== null && payload.replace(/\s/g, '').includes(serviceRoleMarker)) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY holds a service_role key. Use the anon key: the service_role key bypasses RLS and must never reach the client bundle.',
    );
  }
}

function required(source: EnvSource, name: string): string {
  const value = source[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value.trim();
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function readAppEnv(source: EnvSource): AppEnv {
  const supabaseAnonKey = required(source, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  assertNotServiceRoleKey(supabaseAnonKey);
  return {
    supabaseUrl: stripTrailingSlash(required(source, 'EXPO_PUBLIC_SUPABASE_URL')),
    supabaseAnonKey,
    apiBaseUrl: stripTrailingSlash(required(source, 'EXPO_PUBLIC_API_URL')),
  };
}

/**
 * Número de WhatsApp del estudio para el handoff post-pago (spec §7.5).
 *
 * **Opcional a propósito, y fuera de `readAppEnv`.** `readAppEnv` tira cuando
 * falta un valor, y con razón: sin Supabase no hay app. Acá es al revés — el
 * número es un dato de Administración que todavía no llegó, y hacer que la app
 * no arranque por eso sería castigar a todo el producto por una pantalla.
 * Ausente significa "el handoff no se puede ofrecer todavía", y la pantalla lo
 * dice en vez de disimularlo.
 */
export function readEstudioWhatsapp(source: EnvSource): string | null {
  const value = source.EXPO_PUBLIC_ESTUDIO_WHATSAPP;
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

/**
 * The app still runs entirely on mocks when the backend is not configured, so a
 * developer can work offline without a Supabase project.
 */
export function isApiConfigured(source: EnvSource): boolean {
  try {
    readAppEnv(source);
    return true;
  } catch {
    return false;
  }
}
