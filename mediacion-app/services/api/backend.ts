import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js';

import { isApiConfigured, readAppEnv, type EnvSource } from '@/config/env';

import { createApiActivityService, type ApiActivityService } from './activity.api-service';
import { createApiAgreementsService, type ApiAgreementsService } from './agreements.api-service';
import { createApiBillingService, type ApiBillingService } from './billing.api-service';
import { createApiCasesService, type ApiCasesService } from './cases.api-service';
import { createHttpClient, type HttpClient } from './http-client';
import { createApiLegalService, type ApiLegalService } from './legal.api-service';
import { createApiMediatorService, type ApiMediatorService } from './mediator.api-service';
import { createApiNegotiationService, type ApiNegotiationService } from './negotiation.api-service';
import { createApiNoticesService, type ApiNoticesService } from './notices.api-service';
import { createApiPlansService, type ApiPlansService } from './plans.api-service';
import { createApiPositionsService, type PositionsApiService } from './positions.api-service';
import { createApiProfileService, type ProfileApiService } from './profile.api-service';
import { createApiTasksService, type ApiTasksService } from './tasks.api-service';
import { createSupabaseAuthService, type AuthService } from '../auth/auth.service';

export type Backend = {
  auth: AuthService;
  http: HttpClient;
  cases: ApiCasesService;
  positions: PositionsApiService;
  profile: ProfileApiService;
  notices: ApiNoticesService;
  activity: ApiActivityService;
  negotiation: ApiNegotiationService;
  agreements: ApiAgreementsService;
  mediator: ApiMediatorService;
  legal: ApiLegalService;
  /**
   * Only the two subscription endpoints that exist: the vigente read and the
   * baja. There is no checkout and no factura endpoint — see
   * `billing.backed-service.ts` for what that leaves on the mock.
   */
  billing: ApiBillingService;
  /**
   * The catalog read, and only that: `GET /planes` is the whole plan surface
   * of the API — see `plans.backed-service.ts` for what the missing writes
   * leave unavailable.
   */
  plans: ApiPlansService;
  /**
   * The list and the estado update. `POST /tareas/:id/calendario` is not wired
   * — see the header of `services/tasks.service.ts`.
   */
  tasks: ApiTasksService;
};

/** Seams so a suite can build the stack without a network or native storage. */
export type BackendDeps = {
  createClient?: (url: string, anonKey: string) => SupabaseClient;
  authService?: AuthService;
  fetchImpl?: typeof fetch;
};

function defaultCreateClient(url: string, anonKey: string): SupabaseClient {
  return createSupabaseJsClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar to read a callback fragment from.
      detectSessionInUrl: false,
    },
  });
}

/**
 * The single composition root for talking to the real backend.
 *
 * Returns `null` — rather than throwing — whenever the app is not fully
 * configured, including when the anon slot holds a `service_role` key. Callers
 * treat null as "stay on mocks", which keeps a misconfigured build usable
 * instead of a blank screen. The one thing it must never do is build a client
 * around a service_role key, because that key bypasses RLS for every caller.
 */
export function createBackend(
  source: EnvSource,
  deps: BackendDeps = {},
): Backend | null {
  if (!isApiConfigured(source)) {
    return null;
  }
  const env = readAppEnv(source);
  const client = (deps.createClient ?? defaultCreateClient)(
    env.supabaseUrl,
    env.supabaseAnonKey,
  );
  const auth = deps.authService ?? createSupabaseAuthService(client);

  // getToken is a function, not a captured string: Supabase refreshes the
  // access token in the background and a captured one goes stale mid-session.
  const http = createHttpClient({
    baseUrl: env.apiBaseUrl,
    getToken: () => auth.getAccessToken(),
    fetchImpl: deps.fetchImpl,
  });

  return {
    auth,
    http,
    cases: createApiCasesService(http),
    positions: createApiPositionsService(http),
    profile: createApiProfileService(http),
    notices: createApiNoticesService(http),
    activity: createApiActivityService(http),
    negotiation: createApiNegotiationService(http),
    agreements: createApiAgreementsService(http),
    mediator: createApiMediatorService(http),
    legal: createApiLegalService(http),
    billing: createApiBillingService(http),
    plans: createApiPlansService(http),
    tasks: createApiTasksService(http),
  };
}
