import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { TareasController } from "./tareas.controller";
import { TareasRepository } from "./tareas.repository";
import { TareasService } from "./tareas.service";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule],
  controllers: [TareasController],
  providers: [TareasService, TareasRepository],
  exports: [TareasService],
})
export class TareasModule {}
