import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { CarpetasRepository } from "./carpetas.repository";
import { EstudioMembershipService } from "./estudio-membership.service";
import { EstudiosController } from "./estudios.controller";
import { EstudiosRepository } from "./estudios.repository";
import { EstudiosService } from "./estudios.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [EstudiosController],
  providers: [
    EstudiosService,
    EstudioMembershipService,
    EstudiosRepository,
    CarpetasRepository,
  ],
  exports: [EstudiosRepository, CarpetasRepository, EstudioMembershipService],
})
export class EstudiosModule {}
