import type { EstadoSuscripcion, MockSubscription } from '../../types/billing';
import { getSubscriptionNotice } from '../subscription-notice';

function subscription(
  estado: EstadoSuscripcion,
  fechaFin: string | null = null,
): MockSubscription {
  return { id: 'sub-1', planId: 'plan-base', estado, fechaInicio: null, fechaFin };
}

describe('getSubscriptionNotice', () => {
  it('says nothing when there is no subscription', () => {
    expect(getSubscriptionNotice(null)).toBeNull();
  });

  it('says nothing for an active subscription — the plan card already says it', () => {
    expect(getSubscriptionNotice(subscription('activa', null))).toBeNull();
  });

  it('reports a cancelada as a baja on a date, never as service until that date', () => {
    // `fechaFin` is when the baja was registered (BE writes `new Date()`), not
    // the end of a paid period — nothing in the schema records that. Wording
    // this as "sigue vigente hasta" would promise what nobody can honour.
    expect(getSubscriptionNotice(subscription('cancelada', '2026-08-17T12:00:00.000Z'))).toEqual({
      key: 'cancelled',
      fechaFin: '2026-08-17T12:00:00.000Z',
    });
  });

  it('still reports a cancelada that carries no date', () => {
    expect(getSubscriptionNotice(subscription('cancelada', null))).toEqual({
      key: 'cancelledUndated',
      fechaFin: null,
    });
  });

  it('distinguishes vencida from cancelada', () => {
    // Both are "not activa" and both can carry a past `fechaFin`. Collapsing
    // them told a user whose plan lapsed that they had cancelled it.
    expect(getSubscriptionNotice(subscription('vencida', '2026-07-01T12:00:00.000Z'))).toEqual({
      key: 'expired',
      fechaFin: '2026-07-01T12:00:00.000Z',
    });
    expect(getSubscriptionNotice(subscription('vencida', null))).toEqual({
      key: 'expiredUndated',
      fechaFin: null,
    });
  });

  it('reports pausada, the enum value the front had not caught up with', () => {
    // `pausada` entro con la migracion de monetizacion y este tipo no lo
    // tenia; BE ya podia devolverlo. Sin esta rama la pantalla no decia nada
    // para una suscripcion pausada.
    expect(getSubscriptionNotice(subscription('pausada'))).toEqual({
      key: 'paused',
      fechaFin: null,
    });
  });

  it('reports pendiente_pago, which is what a real checkout produces first', () => {
    // `suscripciones.estado` defaults to `pendiente_pago`, so this is the state
    // `POST /suscripciones` leaves behind. Falling through to "no tenés plan"
    // would invite the user to contract the same plan twice.
    expect(getSubscriptionNotice(subscription('pendiente_pago', null))).toEqual({
      key: 'pendingPayment',
      fechaFin: null,
    });
  });
});
