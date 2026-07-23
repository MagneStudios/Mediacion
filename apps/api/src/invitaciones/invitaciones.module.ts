import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { InvitacionesController } from "./invitaciones.controller";
import { InvitacionesRepository } from "./invitaciones.repository";
import { InvitacionesService } from "./invitaciones.service";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule],
  controllers: [InvitacionesController],
  providers: [InvitacionesService, InvitacionesRepository],
})
export class InvitacionesModule {}
