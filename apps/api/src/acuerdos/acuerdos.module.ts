import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { AcuerdosController } from "./acuerdos.controller";
import { AcuerdosRepository } from "./acuerdos.repository";
import { AcuerdosService } from "./acuerdos.service";
import { FirmasRepository } from "./firmas.repository";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule],
  controllers: [AcuerdosController],
  providers: [AcuerdosService, AcuerdosRepository, FirmasRepository],
})
export class AcuerdosModule {}
