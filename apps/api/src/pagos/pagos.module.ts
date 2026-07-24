import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PlanesController } from "./planes.controller";
import { PlanesRepository } from "./planes.repository";
import { PlanesService } from "./planes.service";
import { SuscripcionesController } from "./suscripciones.controller";
import { SuscripcionesRepository } from "./suscripciones.repository";
import { SuscripcionesService } from "./suscripciones.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [PlanesController, SuscripcionesController],
  providers: [
    PlanesService,
    PlanesRepository,
    SuscripcionesService,
    SuscripcionesRepository,
  ],
})
export class PagosModule {}
