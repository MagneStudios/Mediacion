import { expoPublicEnv } from '@/config/env-source';

import { createBackend, type Backend } from './api/backend';

/**
 * The one live backend for the process, or null when the app is not configured
 * to reach one — in which case every service falls back to its mock and the app
 * stays fully usable offline.
 *
 * This module existing and being imported is also what makes the configuration
 * reach the bundle at all: Metro drops unreachable modules, so while nothing
 * imported `config/env-source`, the EXPO_PUBLIC values had nowhere to be
 * inlined into. The service singletons import this, and the screens import
 * those, so the chain is reachable from the entry point.
 */
export const backend: Backend | null = createBackend(expoPublicEnv);

/** True when the screens are talking to the real API rather than to mocks. */
export const isBackendLive = backend !== null;
