import type { EstadoSuscripcion, MockSubscription } from '../types/billing';

/**
 * What "Mi plan" says about a subscription that is not `activa`.
 *
 * `GET /suscripciones/vigente` does not filter by estado (BE's
 * `findVigenteByOwner` only *orders* by it), so all four values of
 * `estado_suscripcion` can arrive here — including `pendiente_pago`, which is
 * the column default of `POST /suscripciones` and therefore what a real
 * checkout will produce first.
 *
 * **`fechaFin` is the moment the subscription was cancelled, not the end of
 * the paid period.** `SuscripcionesService.cancelSuscripcion` writes
 * `new Date().toISOString()` into it, and no table anywhere records how long
 * what was already paid keeps applying. `docs/fichas-legal-backend.md` §10
 * describes that column as "hasta cuándo sigue vigente lo ya pagado", which
 * its own §7 contradicts — the discrepancy is open with BE in
 * `docs/pedidos-frontend-a-backend.md` §6. Until it is resolved these strings
 * say only what the column actually holds: a plan the user cancelled on a
 * date, not a promise of service until that date.
 */
export type SubscriptionNoticeKey =
  | 'cancelled'
  | 'cancelledUndated'
  | 'expired'
  | 'expiredUndated'
  | 'pendingPayment';

export type SubscriptionNotice = {
  /** Key under `billing.myPlan.notice` in the locale files. */
  key: SubscriptionNoticeKey;
  /** The raw `fechaFin`, for the dated variants only. The caller formats it. */
  fechaFin: string | null;
};

/**
 * `null` means there is nothing to say: either there is no subscription, or it
 * is `activa` and the plan card already carries that.
 */
export function getSubscriptionNotice(
  subscription: MockSubscription | null,
): SubscriptionNotice | null {
  if (!subscription) {
    return null;
  }
  const estado: EstadoSuscripcion = subscription.estado;
  switch (estado) {
    case 'activa':
      return null;
    case 'cancelada':
      return subscription.fechaFin
        ? { key: 'cancelled', fechaFin: subscription.fechaFin }
        : { key: 'cancelledUndated', fechaFin: null };
    case 'vencida':
      return subscription.fechaFin
        ? { key: 'expired', fechaFin: subscription.fechaFin }
        : { key: 'expiredUndated', fechaFin: null };
    case 'pendiente_pago':
      // No date: nothing has ended, the contract never started being charged.
      return { key: 'pendingPayment', fechaFin: null };
    default: {
      // A fifth `estado_suscripcion` value fails `tsc` here rather than
      // silently rendering nothing on a screen that owes the user an answer.
      const exhaustive: never = estado;
      return exhaustive;
    }
  }
}
