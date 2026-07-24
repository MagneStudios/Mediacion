import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { CarpetasRepository } from "./carpetas.repository";
import { EstudioMembershipService } from "./estudio-membership.service";
import { EstudiosRepository } from "./estudios.repository";

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [EstudioMembershipService, EstudiosRepository, CarpetasRepository],
  exports: [EstudiosRepository, CarpetasRepository, EstudioMembershipService],
})
export class EstudiosModule {}
