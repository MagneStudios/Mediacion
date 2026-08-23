import type { EstadoSuscripcion, MockSubscription } from '../../types/billing';
import { canRequestLawyer } from '../subscription-access';

function subscription(estado: EstadoSuscripcion): MockSubscription {
  return { id: 'sub-1', planId: 'p', estado, fechaInicio: null, fechaFin: null };
}

describe('canRequestLawyer', () => {
  it('allows an active subscription', () => {
    expect(canRequestLawyer(subscription('activa'))).toBe(true);
  });

  it('allows a vencida one, which is the spec’s past_due', () => {
    // Hay 7 dias de gracia y MercadoPago reintenta el cobro: cortarle el
    // acceso a alguien cuya tarjeta rebota una vez seria cortarlo antes de
    // que el propio sistema haya dado por perdido el cobro.
    expect(canRequestLawyer(subscription('vencida'))).toBe(true);
  });

  it.each<[EstadoSuscripcion]>([['pendiente_pago'], ['pausada'], ['cancelada']])(
    'blocks %s',
    (estado) => {
      expect(canRequestLawyer(subscription(estado))).toBe(false);
    },
  );

  it('blocks someone with no subscription at all', () => {
    expect(canRequestLawyer(null)).toBe(false);
  });
});
