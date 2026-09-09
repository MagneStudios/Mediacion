import { Module } from "@nestjs/common";
import { AbogadoModule } from "../../abogado/abogado.module";
import { MercadopagoModule } from "../mercadopago/mercadopago.module";
import { PagosModule } from "../pagos.module";
import { MercadoPagoWebhookController } from "./mercadopago.controller";
import { PaymentRouterService } from "./payment-router.service";

/**
 * Sits above both payment domains so neither has to import the other: it is the
 * only place that knows a Mercado Pago payment can belong to a suscripcion or
 * to a solicitud de abogado.
 */
@Module({
  imports: [PagosModule, AbogadoModule, MercadopagoModule],
  controllers: [MercadoPagoWebhookController],
  providers: [PaymentRouterService],
})
export class WebhooksModule {}
