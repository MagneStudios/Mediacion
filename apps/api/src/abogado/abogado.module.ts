import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { MercadopagoModule } from "../pagos/mercadopago/mercadopago.module";
import { AbogadoController } from "./abogado.controller";
import { AbogadoRepository } from "./abogado.repository";
import { AbogadoService } from "./abogado.service";
import { LAWYER_PAYMENT_HANDLER } from "./lawyer-payment.port";

/**
 * Imports the gateway seam rather than PagosModule: PagosModule imports this
 * one back, for the webhook routing port, and importing it here would close the
 * cycle.
 */
@Module({
  imports: [AuthModule, DatabaseModule, CasosModule, MercadopagoModule],
  controllers: [AbogadoController],
  providers: [
    AbogadoService,
    AbogadoRepository,
    { provide: LAWYER_PAYMENT_HANDLER, useExisting: AbogadoService },
  ],
  exports: [LAWYER_PAYMENT_HANDLER],
})
export class AbogadoModule {}
