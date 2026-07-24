import { Inject, Injectable } from "@nestjs/common";
import { MetricasRepository } from "./metricas.repository";
import type { MetricasDto } from "./types";

@Injectable()
export class MetricasService {
  constructor(
    @Inject(MetricasRepository)
    private readonly metricasRepository: MetricasRepository,
  ) {}

  getMetricas(): Promise<MetricasDto> {
    return this.metricasRepository.getMetricas();
  }
}
