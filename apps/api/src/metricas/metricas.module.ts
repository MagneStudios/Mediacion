import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { MetricasController } from "./metricas.controller";
import { MetricasRepository } from "./metricas.repository";
import { MetricasService } from "./metricas.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MetricasController],
  providers: [MetricasService, MetricasRepository],
})
export class MetricasModule {}
