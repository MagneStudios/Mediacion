import { getMediatorEligibility } from '../mediator-eligibility';
import { getNegotiationEligibility } from '../negotiation-eligibility';
import { getPositionEligibility } from '../position-eligibility';

/**
 * C-01 — qué se puede hacer en un caso que el gate de suscripciones dejó en
 * `pendiente_suscripciones` (`20260902120000_c01_gate_suscripciones.sql`).
 *
 * Las tres utils ya tenían un default conservador para estados desconocidos,
 * así que el valor nuevo no rompía nada aunque nadie lo mirara. Justamente por
 * eso se testea: sin esto, la respuesta correcta y el olvido son
 * indistinguibles, y un cambio de default los separaría en silencio.
 */
describe('estado pendiente_suscripciones', () => {
  it('no permite cargar ni ver posiciones — el caso todavía no se abrió', () => {
    expect(getPositionEligibility('pendiente_suscripciones')).toBe('ineligible');
  });

  it('no habilita la negociación, y no la confunde con esperar a la contraparte', () => {
    // La contraparte ya está; lo que falta es una suscripción. Devolver
    // `waiting_counterparty` mandaría a esperar a alguien que ya llegó.
    const eligibility = getNegotiationEligibility('pendiente_suscripciones', 2, true, null, null);
    expect(eligibility).toBe('read_only');
    expect(eligibility).not.toBe('waiting_counterparty');
  });

  it('no ofrece acompañamiento de mediador — ninguna ronda pudo empezar', () => {
    expect(getMediatorEligibility('pendiente_suscripciones', null, null)).toBe(
      'unavailable_before_round_3',
    );
  });

  it('tampoco lo ofrece si un dato viejo dice que hubo rondas', () => {
    // El gate impide activar el caso, así que un ronda_actual >= 3 acá sólo
    // puede venir de un dato desactualizado. No es motivo para habilitar nada.
    expect(getMediatorEligibility('pendiente_suscripciones', 4, null)).toBe(
      'unavailable_before_round_3',
    );
  });
});
