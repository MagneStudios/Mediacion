import { Controller, Get, Inject } from "@nestjs/common";
import type { Plan } from "./pagos.types";
import { PlanesService } from "./planes.service";

@Controller("planes")
export class PlanesController {
  constructor(
    @Inject(PlanesService) private readonly planesService: PlanesService,
  ) {}

  @Get()
  listPlanes(): Promise<Plan[]> {
    return this.planesService.listPlanes();
  }
}
