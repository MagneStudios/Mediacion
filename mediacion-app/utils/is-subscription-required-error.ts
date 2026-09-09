import { codeCasoBloqueadoSuscripciones, isApiError } from '../services/api/api-error';

/**
 * True cuando una operación falló porque el gate C-01 exige que **las dos
 * partes** tengan suscripción activa antes de que el caso se active
 * (`trg_casos_gate_suscripciones`).
 *
 * Hermano de `is-invitation-expired-error.ts`, y por el mismo motivo: sin
 * esto, el `409` cae en el error genérico de `joinCase` y la pantalla dice
 * "revisá el enlace o código" sobre un código que está perfecto. Reintentar
 * nunca lo arregla; suscribirse sí.
 *
 * Funciona contra las dos implementaciones sin que ninguna importe a la otra:
 * la API real responde `{ error: { code: 'caso_bloqueado_suscripciones' } }`,
 * y el mock rechaza con `new Error(codeCasoBloqueadoSuscripciones)`.
 *
 * **Ojo con la asimetría de la unión:** del lado del backend la transacción de
 * `joinCase` hace rollback entero, así que quien intentó unirse **no queda
 * registrado como parte del caso**. No hay nada a medio hacer que limpiar.
 */
export function isSubscriptionRequiredError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === codeCasoBloqueadoSuscripciones;
  }
  return error instanceof Error && error.message === codeCasoBloqueadoSuscripciones;
}
