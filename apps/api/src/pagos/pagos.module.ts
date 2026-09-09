import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { MercadopagoModule } from "./mercadopago/mercadopago.module";
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
import { UsageRepository } from "./usage.repository";

@Module({
  imports: [AuthModule, DatabaseModule, MercadopagoModule],
  controllers: [PlanesController, SuscripcionesController, PagosController],
  providers: [
    PlanesService,
    PlanesRepository,
    SuscripcionesService,
    SuscripcionesRepository,
    PagosService,
    PagosRepository,
    PlanLimitService,
    UsageRepository,
  ],
  exports: [
    PlanLimitService,
    UsageRepository,
    SuscripcionesService,
    PagosService,
  ],
})
export class PagosModule {}
