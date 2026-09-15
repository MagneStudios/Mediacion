import { codeInvitacionNoReenviable, isApiError } from '../services/api/api-error';

/**
 * True when a `resendInvitation`/`regenerateInvitation` rejection means "esta
 * invitación ya no admite reenvío" (aceptada, rechazada, o ya no vigente) en
 * vez de un fallo transitorio. Mismo criterio de doble chequeo que
 * `isInvitationExpiredError`, contra las dos implementaciones de servicio:
 * - la mock rechaza con `new Error(codeInvitacionNoReenviable)`
 * - la real responde `{ error: { code: 'invitacion_no_reenviable' } }`, que
 *   `http-client.ts` convierte en un `ApiError` con el mismo code
 *
 * Reintentar nunca puede arreglar esto — hace falta invitar de nuevo — así
 * que quien llama lo usa para mostrar un mensaje específico en vez del error
 * genérico con reintento.
 */
export function isInvitacionNoReenviableError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === codeInvitacionNoReenviable;
  }
  return error instanceof Error && error.message === codeInvitacionNoReenviable;
}
