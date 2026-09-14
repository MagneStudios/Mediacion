import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PagosModule } from "../pagos/pagos.module";
import { CasosController } from "./casos.controller";
import { CasosRepository } from "./casos.repository";
import { CasosService } from "./casos.service";
import { MembershipService } from "./membership.service";
import { ModeracionModule } from "../moderacion/moderacion.module";

@Module({
  imports: [AuthModule, DatabaseModule, PagosModule, ModeracionModule],
  controllers: [CasosController],
  providers: [CasosService, CasosRepository, MembershipService],
  exports: [CasosRepository, MembershipService],
})
export class CasosModule {}
