import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { IncumplimientosController } from "./incumplimientos.controller";
import { IncumplimientosRepository } from "./incumplimientos.repository";
import { IncumplimientosService } from "./incumplimientos.service";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule],
  controllers: [IncumplimientosController],
  providers: [IncumplimientosService, IncumplimientosRepository],
})
export class IncumplimientosModule {}
