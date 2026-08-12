import { codeInvitationExpired, isApiError } from '../services/api/api-error';

/**
 * True when a `joinCase` rejection means "this invitation is past its 72 h
 * TTL" (R-04) rather than an unknown/already-redeemed token or a transient
 * failure. Works against both service implementations without either one
 * importing the other:
 * - the mock service rejects with `new Error(codeInvitationExpired)`
 * - the real API answers `{ error: { code: 'invitation_expired' } }`, which
 *   `http-client.ts` turns into an `ApiError` carrying the same code
 *
 * Callers use this to show "pedí una invitación nueva" instead of the
 * generic "check the code and try again" — retrying an expired token can
 * never succeed, so the two messages must not be conflated.
 */
export function isInvitationExpiredError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === codeInvitationExpired;
  }
  return error instanceof Error && error.message === codeInvitationExpired;
}
