import { codeNegociacionNotAcordada, isApiError } from '../services/api/api-error';

/**
 * True cuando renegociar falló porque la materia **ya no tiene un acuerdo
 * vigente y firmado** — `409 negociacion_not_acordada`. Incluye renegociar dos
 * veces seguidas: después de la primera, el vigente es un borrador.
 *
 * Hermano de `is-subscription-required-error.ts`, y por el mismo motivo: sin
 * esto, el `409` cae en el error genérico y la pantalla ofrece "reintentar"
 * sobre algo que reintentar no arregla. Lo que corresponde es releer la lista:
 * lo más probable es que la otra parte haya renegociado primero.
 *
 * Funciona contra las dos implementaciones sin que ninguna importe a la otra:
 * la API real responde `{ error: { code: 'negociacion_not_acordada' } }`, y el
 * mock rechaza con `new Error(codeNegociacionNotAcordada)`.
 */
export function isNegotiationNotAcordadaError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === codeNegociacionNotAcordada;
  }
  return error instanceof Error && error.message === codeNegociacionNotAcordada;
}
