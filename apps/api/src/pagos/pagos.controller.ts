import { Controller, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { PagosService } from "./pagos.service";
import type { PreferenceResult } from "./pagos.types";

@Controller("suscripciones")
export class PagosController {
  constructor(
    @Inject(PagosService) private readonly pagosService: PagosService,
  ) {}

  @Post(":id/pago")
  createPreference(
    @CurrentUser() caller: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) suscripcionId: string,
  ): Promise<PreferenceResult> {
    return this.pagosService.createPreference(suscripcionId, caller.id);
  }
}
