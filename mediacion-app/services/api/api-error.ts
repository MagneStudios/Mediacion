/**
 * Every API failure arrives as `{ error: { code, message } }` (see
 * `apps/api/src/common/filters/all-exceptions.filter.ts`). Screens branch on
 * `code`, never on the human-facing `message`, so the wording can change
 * without breaking behaviour.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** The caller's Supabase user has no row in `public.usuarios` yet. */
export const codeUserNotProvisioned = 'user_not_provisioned';
export const codeUnauthorized = 'unauthorized';
export const codeNotFound = 'not_found';
export const codeCasoNotFound = 'caso_not_found';
export const codeAcuerdoNotFound = 'acuerdo_not_found';
export const codeMediacionNotFound = 'mediacion_not_found';
export const codeItemNotFound = 'item_not_found';
export const codePropuestaNotReady = 'propuesta_not_ready';
export const codePropuestaAlreadyExists = 'propuesta_already_exists';
export const codeBothPartiesRequired = 'both_parties_required';
export const codeInvalidToken = 'invalid_token';
export const codeNetworkUnavailable = 'network_unavailable';
/** R-04: an invitation token that existed but is past its TTL (72 h) — kept
 * distinct from `codeInvalidToken` so the join screen can show "this
 * invitation expired" instead of a generic "check the code" message. */
export const codeInvitationExpired = 'invitation_expired';

const unknownErrorCode = 'internal_error';
const unknownErrorMessage = 'Unexpected error';

type ErrorEnvelope = { error?: { code?: unknown; message?: unknown } };

/**
 * A gateway or proxy can answer with HTML or an empty body, so the envelope is
 * treated as untrusted rather than assumed well formed.
 */
export function toApiError(status: number, body: unknown): ApiError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  const code =
    typeof envelope.error?.code === 'string' ? envelope.error.code : unknownErrorCode;
  const message =
    typeof envelope.error?.message === 'string'
      ? envelope.error.message
      : unknownErrorMessage;
  return new ApiError(code, message, status);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}
