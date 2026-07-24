import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { AuditoriaController } from "./auditoria.controller";
import { AuditoriaRepository } from "./auditoria.repository";
import { AuditoriaService } from "./auditoria.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, AuditoriaRepository],
})
export class AuditoriaModule {}
