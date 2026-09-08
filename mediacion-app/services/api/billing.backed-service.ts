import type { MockInvoice, MockSubscription, SubscriptionUsage } from '@/types/billing';

import { codeSuscripcionNotFound, hasCode } from './api-error';
import type { ApiBillingService } from './billing.api-service';
import type { BillingService } from '../billing.service';

/** Same rejection reason the mock uses, so the screen branches identically. */
const noActiveSubscription = 'no_active_subscription';

/**
 * Presents the real subscription endpoints under the `BillingService` contract
 * the Mi plan screen already consumes, and leaves the rest on the mock that is
 * passed in.
 *
 * **What is real:** `getCurrentSubscription`, `getUsage` and
 * `cancelSubscription`. The first and last are
 * exactly what `docs/pedidos-frontend-a-backend.md` §2 asked for: the baja
 * online (Ley 24.240 art. 10 ter, punto #19) used to point at a mock id whose
 * value was synthetic, so `POST /suscripciones/:id/baja` would have answered
 * `404 suscripcion_not_found`. Now the id comes from the server that owns it.
 *
 * **What stays mocked, and why:** `subscribeToPlan`, `getInvoiceForSubscription`
 * and `prepareInvoiceDownload`. There is no factura endpoint on the API, and
 * `POST /suscripciones/:id/pago` returns a Mercado Pago `init_point` the user
 * must be redirected to — it does not confirm a payment. Wiring the checkout
 * through it would make this app report an approved payment and emit an invoice
 * for money nobody charged, which is worse than a checkout that says it is a
 * demo.
 *
 * **The visible consequence, stated out loud:** with a backend configured, Mi
 * plan reflects the real `suscripciones` row, so subscribing through the demo
 * checkout no longer shows up there. That is the truth of the current state —
 * there is no real checkout — rather than a mock pretending otherwise.
 *
 * `getCurrentSubscription` maps `404 suscripcion_not_found` to `null`: "no
 * tengo plan" is a normal answer, and it is also what BE returns for a
 * subscription that exists but is not the caller's, on purpose. Every other
 * failure still propagates so the screen shows its error state with a retry.
 */
export function createBackedBillingService(
  api: ApiBillingService,
  mock: BillingService,
): BillingService {
  return {
    async getCurrentSubscription(): Promise<MockSubscription | null> {
      try {
        return await api.getCurrentSubscription();
      } catch (error) {
        if (hasCode(error, codeSuscripcionNotFound)) {
          return null;
        }
        throw error;
      }
    },

    async getUsage(): Promise<SubscriptionUsage | null> {
      // Same mapping as the read above, for the same reason: BE answers 404
      // `suscripcion_not_found` both for "you have no plan" and for a
      // subscription that is not yours, so an outsider cannot probe which ones
      // exist. "No tengo plan" is a normal state of Mi plan, not a failure.
      //
      // One consequence worth knowing rather than hiding: a member of an
      // estudio who is not its titular consumes quota against the estudio's
      // plan but cannot read its usage, so this returns `null` for someone who
      // demonstrably has one (`docs/changelogs/2026-09-03-uso-y-cuota.md`,
      // "Deuda conocida"). That is BE's asymmetry to resolve; papering over it
      // here would mean inventing a plan we cannot see.
      try {
        return await api.getUsage();
      } catch (error) {
        if (hasCode(error, codeSuscripcionNotFound)) {
          return null;
        }
        throw error;
      }
    },

    async cancelSubscription(): Promise<MockSubscription> {
      // The id is read back rather than remembered: the screen's cancel button
      // carries no id, and a stale one from an earlier render would cancel the
      // wrong row after a plan change.
      //
      // If the subscription is gone by the time the user confirms — cancelled
      // in another tab, or expired — the read 404s. That is reported as
      // `no_active_subscription`, the same code the mock uses, so the screen
      // shows its error state instead of a raw 404 the user cannot act on.
      let current: MockSubscription;
      try {
        current = await api.getCurrentSubscription();
      } catch (error) {
        if (hasCode(error, codeSuscripcionNotFound)) {
          throw new Error(noActiveSubscription);
        }
        throw error;
      }
      const cancelled = await api.cancelSubscription(current.id);
      return {
        ...current,
        estado: cancelled.estado,
        fechaFin: cancelled.fecha_fin,
      };
    },

    getInvoiceForSubscription(subscriptionId: string): Promise<MockInvoice | null> {
      return mock.getInvoiceForSubscription(subscriptionId);
    },

    subscribeToPlan(
      planId: string,
    ): Promise<{ subscription: MockSubscription; invoice: MockInvoice }> {
      return mock.subscribeToPlan(planId);
    },

    prepareInvoiceDownload(invoiceId: string): Promise<void> {
      return mock.prepareInvoiceDownload(invoiceId);
    },
  };
}
