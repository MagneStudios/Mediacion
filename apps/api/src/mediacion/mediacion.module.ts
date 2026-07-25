import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { MediacionController } from "./mediacion.controller";
import { MediacionService } from "./mediacion.service";
import { MediacionesRepository } from "./mediaciones.repository";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule],
  controllers: [MediacionController],
  providers: [MediacionesRepository, MediacionService],
  exports: [MediacionesRepository, MediacionService],
})
export class MediacionModule {}
