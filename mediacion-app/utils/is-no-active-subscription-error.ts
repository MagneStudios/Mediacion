import { codeNoActiveSubscription, isApiError } from '../services/api/api-error';

/**
 * True cuando una operación falló porque **quien la pide** no tiene ninguna
 * suscripción activa (`consume_quota`, `NO_ACTIVE_SUBSCRIPTION`).
 *
 * Hermano de `is-subscription-required-error.ts` y deliberadamente separado:
 * aquel responde al gate C-01, que exige suscripción en **las dos partes** de
 * un caso que ya existe. Este es el alta, y habla solo de la propia. Unirlos
 * ahorraría un archivo y costaría el consejo: "las dos partes necesitan un
 * plan" es desconcertante cuando todavía no hay ninguna otra parte.
 *
 * Sin esto el 409 cae en el error genérico de la pantalla de alta, que dice
 * "No pudimos crear el caso" y ofrece reintentar — y reintentar no lo arregla
 * nunca, porque no hay nada roto: falta contratar.
 *
 * Funciona contra las dos implementaciones sin que ninguna importe a la otra:
 * la API real responde `{ error: { code: 'no_active_subscription' } }`, y el
 * mock rechaza con `new Error(codeNoActiveSubscription)`.
 */
export function isNoActiveSubscriptionError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === codeNoActiveSubscription;
  }
  return error instanceof Error && error.message === codeNoActiveSubscription;
}
