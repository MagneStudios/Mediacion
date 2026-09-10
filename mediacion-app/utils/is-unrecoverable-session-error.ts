import { codeProfileNotFound, codeUserNotProvisioned, isApiError } from '../services/api/api-error';

/**
 * True when a signed-in Supabase identity has no matching record on our
 * side — no row in `usuarios` (`user_not_provisioned`), or `GET`/`PATCH /me`
 * found none (`profile_not_found`). Both collapse to the same user-facing
 * fact ("tu cuenta no está lista") and the same fix (sign out, sign back in;
 * contact support if it persists), so they share one check rather than two.
 *
 * This is *not* a transient failure: before this helper existed, hitting
 * either code fell into the generic error screen, whose only action is
 * "reintentar" — retrying re-sends the exact same request and gets the exact
 * same rejection forever. Distinguishing it lets the screen offer the one
 * action that can actually get the user unstuck.
 */
export function isUnrecoverableSessionError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === codeUserNotProvisioned || error.code === codeProfileNotFound;
  }
  return (
    error instanceof Error &&
    (error.message === codeUserNotProvisioned || error.message === codeProfileNotFound)
  );
}
