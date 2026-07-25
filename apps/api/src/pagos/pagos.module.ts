import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { HttpMercadoPagoClient } from "./mercadopago/http-mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "./mercadopago/mercado-pago-client";
import { PagosController } from "./pagos.controller";
import { PagosRepository } from "./pagos.repository";
import { PagosService } from "./pagos.service";
import { PlanLimitService } from "./plan-limit.service";
import { PlanesController } from "./planes.controller";
import { PlanesRepository } from "./planes.repository";
import { PlanesService } from "./planes.service";
import { SuscripcionesController } from "./suscripciones.controller";
import { SuscripcionesRepository } from "./suscripciones.repository";
import { SuscripcionesService } from "./suscripciones.service";
import { MercadoPagoWebhookController } from "./webhooks/mercadopago.controller";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    PlanesController,
    SuscripcionesController,
    PagosController,
    MercadoPagoWebhookController,
  ],
  providers: [
    PlanesService,
    PlanesRepository,
    SuscripcionesService,
    SuscripcionesRepository,
    PagosService,
    PagosRepository,
    PlanLimitService,
    { provide: MERCADO_PAGO_CLIENT, useClass: HttpMercadoPagoClient },
  ],
  exports: [PlanLimitService],
})
export class PagosModule {}
