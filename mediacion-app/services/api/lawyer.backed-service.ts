import type {
  LawyerRequest,
  LawyerRequestCheckout,
  LawyerServiceOffer,
} from '../../types/lawyer';
import type { LawyerService } from '../lawyer.service';
import { lawyerFeeFixture } from '../lawyer.service';
import type { ApiLawyerService } from './lawyer.api-service';
import { toLawyerRequest } from './lawyer.api-service';

/**
 * Presents the real `/casos/:casoId/solicitud-abogado` API under the contract
 * the screens already consume.
 *
 * The honest gaps:
 *
 * - **`getOffer()` has no server counterpart.** `scope` and `responseHours` are
 *   decisions the estudio (Solmi) still owes, and the API has no column nor
 *   endpoint for them — so they are always `null`, exactly like the mock. The
 *   fee has no catalog endpoint either: the price only exists once a solicitud
 *   row is created (frozen from `LAWYER_FEE_ARS_MINOR`). Until an offer endpoint
 *   exists, the offer shows the known config fee with the scope still blocked,
 *   so `canPay` stays false and nobody is charged for a service that is not
 *   yet described. This is not a workaround to resolve here — it is the real
 *   state, and the button stays blocked by decision (pedido #1,
 *   `docs/respuestas-cliente-01-09-2026.md`).
 *
 * - **`simulatePaymentConfirmation` is a no-op re-read.** It exists only to
 *   satisfy the mock's demo affordance; against a real backend nothing is
 *   simulated — the webhook of Mercado Pago confirms the payment, and the
 *   screen re-reads `getRequest` on focus to reflect it. The method is gated
 *   out of the UI by `isBackendLive`, so it is never called in production.
 */
export function createBackedLawyerService(api: ApiLawyerService): LawyerService {
  return {
    async getOffer(): Promise<LawyerServiceOffer> {
      return {
        fee: lawyerFeeFixture,
        scope: null,
        responseHours: null,
      };
    },

    async getRequest(casoId: string): Promise<LawyerRequest | null> {
      const row = await api.getRequest(casoId);
      return row === null ? null : toLawyerRequest(row);
    },

    async requestLawyer(casoId: string): Promise<LawyerRequestCheckout> {
      const checkout = await api.requestLawyer(casoId);
      return {
        request: toLawyerRequest(checkout.solicitud),
        checkoutUrl: checkout.init_point,
      };
    },

    async simulatePaymentConfirmation(casoId: string): Promise<LawyerRequest> {
      // Same no-op as `cases`'s `simulateInvitationAcceptance`: the real
      // confirmation is the webhook's, so the honest thing is a re-read.
      const request = await this.getRequest(casoId);
      if (request === null) {
        throw new Error('mock_lawyer_request_not_found');
      }
      return request;
    },
  };
}
