import type {
  CheckoutStart,
  MockInvoice,
  MockSubscription,
  SubscriptionUsage,
} from '@/types/billing';
import { toCheckoutUrl } from '@/utils/checkout-url';

import { codeSuscripcionNotFound, hasCode } from './api-error';
import type { ApiBillingService } from './billing.api-service';
import type { BillingService } from '../billing.service';

/** Same rejection reason the mock uses, so the screen branches identically. */
const noActiveSubscription = 'no_active_subscription';

/**
 * El `init_point` no pasó `toCheckoutUrl`. Se distingue de un fallo de red
 * porque reintentar no lo arregla: la URL que devolvió el servidor no es una
 * que estemos dispuestos a abrir.
 */
export const errorCheckoutUrlUnusable = 'checkout_url_unusable';

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
 * **`startCheckout` is real too, since 09/09.** The reason this file used to
 * give for not wiring it —*"`pago` does not confirm a payment, so the app would
 * report an approved payment for money nobody charged"*— stopped being true:
 * `POST /webhooks/mercadopago` verifies the HMAC signature and `applyPayment`
 * sets `estado: activa` plus the billing period server-side. **This app reports
 * nothing.** It creates a subscription (which starts at `pendiente_pago`),
 * hands back Mercado Pago's checkout, and then reads the same
 * `GET /suscripciones/vigente` it already consumed.
 *
 * That mattered more than a missing feature. `suscripciones.estado` defaults to
 * `pendiente_pago`, and only the webhook and `reactivate` ever write `activa`
 * — so with a simulated checkout **nobody could reach `activa` through the
 * app at all**, and the C-01 gate needs an active subscription on *both*
 * parties before a caso leaves `nuevo`. That is the "la simulación de
 * aceptación no funciona" the client reported
 * (`docs/auditoria-desbloqueos-09-09-2026.md` §2).
 *
 * **What stays mocked, and why:** `subscribeToPlan`, `getInvoiceForSubscription`
 * and `prepareInvoiceDownload`. There is still no factura endpoint on the API,
 * so an invoice can only be a mock one — which is exactly why `startCheckout`
 * exists as a separate method that returns no invoice at all rather than
 * fabricating one.
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

    async startCheckout(planId: string): Promise<CheckoutStart> {
      // Dos llamadas y en este orden, porque la preferencia de Mercado Pago se
      // arma a partir de la fila de la suscripción: sin suscripción no hay
      // `external_reference`, y sin `external_reference` el webhook no sabría
      // a qué fila aplicarle el pago.
      const created = await api.createSubscription(planId);
      const preference = await api.startPayment(created.id);
      const checkoutUrl = toCheckoutUrl(preference.init_point);
      if (checkoutUrl === null) {
        // La suscripción quedó creada en `pendiente_pago`, que es un estado
        // legítimo y no cobra nada. Fallar acá es lo correcto: abrir una URL
        // que no pasó la validación sería peor que no abrir ninguna.
        throw new Error(errorCheckoutUrlUnusable);
      }
      return { kind: 'redirect', subscriptionId: created.id, checkoutUrl };
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
