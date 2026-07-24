import { Controller, Inject, Param, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { AcuerdosService } from "./acuerdos.service";
import type { Acuerdo } from "./acuerdos.types";

@Controller()
export class AcuerdosController {
  constructor(
    @Inject(AcuerdosService) private readonly acuerdosService: AcuerdosService,
  ) {}

  @Post("casos/:casoId/acuerdo")
  generateAgreement(
    @Param("casoId") casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<Acuerdo> {
    return this.acuerdosService.generateAgreement(casoId, caller.id);
  }

  @Post("acuerdos/:id/firmar")
  sendToSignature(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<Acuerdo> {
    return this.acuerdosService.sendToSignature(id, caller.id);
  }
}
