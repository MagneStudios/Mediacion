import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ConfiguracionController } from "./configuracion.controller";
import { ConfiguracionRepository } from "./configuracion.repository";
import { ConfiguracionService } from "./configuracion.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService, ConfiguracionRepository],
})
export class ConfiguracionModule {}
