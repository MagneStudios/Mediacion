import { Inject, Injectable } from "@nestjs/common";
import { isSolicitudAbogadoReference } from "../../abogado/abogado.types";
import type { LawyerPaymentHandler } from "../../abogado/lawyer-payment.port";
import { LAWYER_PAYMENT_HANDLER } from "../../abogado/lawyer-payment.port";
import type { MercadoPagoClient } from "../mercadopago/mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "../mercadopago/mercado-pago-client";
import { PagosService } from "../pagos.service";

const approvedStatus = "approved";

/**
 * Mercado Pago sends every payment to one webhook, so the external reference is
 * the only thing that says which domain the money belongs to: a lawyer request
 * carries a prefixed reference, a subscription a bare suscripcion uuid.
 *
 * Routing is not a nicety. Handing a `lawreq_` reference to the subscription
 * path would insert it as `pagos.suscripcion_id` and fail on the uuid cast, so
 * the webhook would answer 500 and Mercado Pago would redeliver the same event
 * indefinitely.
 *
 * It lives here, above both domains, because payments must not import the
 * lawyer domain: casos already imports payments, and the lawyer domain imports
 * casos.
 */
@Injectable()
export class PaymentRouterService {
  constructor(
    @Inject(MERCADO_PAGO_CLIENT)
    private readonly mercadoPagoClient: MercadoPagoClient,
    @Inject(PagosService) private readonly pagosService: PagosService,
    @Inject(LAWYER_PAYMENT_HANDLER)
    private readonly lawyerPaymentHandler: LawyerPaymentHandler,
  ) {}

  async processWebhookPayment(mpPaymentId: string): Promise<void> {
    const payment = await this.mercadoPagoClient.getPayment(mpPaymentId);
    if (
      payment.externalReference &&
      isSolicitudAbogadoReference(payment.externalReference)
    ) {
      await this.lawyerPaymentHandler.settlePayment({
        externalReference: payment.externalReference,
        mpPaymentId: payment.id,
        approved: payment.status === approvedStatus,
      });
      return;
    }
    await this.pagosService.processWebhookPayment(mpPaymentId);
  }
}
