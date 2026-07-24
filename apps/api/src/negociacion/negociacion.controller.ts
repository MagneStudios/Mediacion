import { Controller, Inject, Param, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { NegociacionService } from "./negociacion.service";
import type { PropuestaView } from "./negociacion.types";

@Controller()
export class NegociacionController {
  constructor(
    @Inject(NegociacionService)
    private readonly negociacionService: NegociacionService,
  ) {}

  @Post("casos/:casoId/propuestas")
  createPropuesta(
    @Param("casoId") casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PropuestaView> {
    return this.negociacionService.generatePropuesta(casoId, caller.id);
  }
}
