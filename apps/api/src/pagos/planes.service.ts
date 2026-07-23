import { Inject, Injectable } from "@nestjs/common";
import type { Plan } from "./pagos.types";
import { PlanesRepository } from "./planes.repository";

@Injectable()
export class PlanesService {
  constructor(
    @Inject(PlanesRepository)
    private readonly planesRepository: PlanesRepository,
  ) {}

  listPlanes(): Promise<Plan[]> {
    return this.planesRepository.listPlanes();
  }
}
