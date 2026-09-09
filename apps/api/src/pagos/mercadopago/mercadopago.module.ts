import { Module } from "@nestjs/common";
import { HttpMercadoPagoClient } from "./http-mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "./mercado-pago-client";

/**
 * The gateway seam on its own, so a domain that merely charges through Mercado
 * Pago does not have to import the whole of PagosModule — which is what would
 * make PagosModule and that domain import each other. APP_CONFIG comes from the
 * global ConfigModule.
 */
@Module({
  providers: [
    { provide: MERCADO_PAGO_CLIENT, useClass: HttpMercadoPagoClient },
  ],
  exports: [MERCADO_PAGO_CLIENT],
})
export class MercadopagoModule {}
