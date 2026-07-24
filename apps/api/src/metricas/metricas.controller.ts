import { Controller, Get, Inject } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { MetricasService } from "./metricas.service";
import type { MetricasDto } from "./types";

@Controller("metricas")
export class MetricasController {
  constructor(
    @Inject(MetricasService)
    private readonly metricasService: MetricasService,
  ) {}

  @Get()
  @Roles("admin")
  getMetricas(): Promise<MetricasDto> {
    return this.metricasService.getMetricas();
  }
}
