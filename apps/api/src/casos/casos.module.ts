import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { CasosController } from "./casos.controller";
import { CasosRepository } from "./casos.repository";
import { CasosService } from "./casos.service";
import { MembershipService } from "./membership.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [CasosController],
  providers: [CasosService, CasosRepository, MembershipService],
  exports: [CasosRepository, MembershipService],
})
export class CasosModule {}
