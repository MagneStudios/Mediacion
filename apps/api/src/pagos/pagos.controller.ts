import { Controller, Inject, Param, Post } from "@nestjs/common";
import { PagosService } from "./pagos.service";
import type { PreferenceResult } from "./pagos.types";

@Controller("suscripciones")
export class PagosController {
  constructor(
    @Inject(PagosService) private readonly pagosService: PagosService,
  ) {}

  @Post(":id/pago")
  createPreference(
    @Param("id") suscripcionId: string,
  ): Promise<PreferenceResult> {
    return this.pagosService.createPreference(suscripcionId);
  }
}
