import { Module } from "@nestjs/common";
import { AcuerdosModule } from "../acuerdos/acuerdos.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { ActividadController } from "./actividad.controller";
import { ActividadRepository } from "./actividad.repository";
import { ActividadService } from "./actividad.service";

@Module({
  imports: [DatabaseModule, CasosModule, AcuerdosModule],
  controllers: [ActividadController],
  providers: [ActividadRepository, ActividadService],
})
export class ActividadModule {}
