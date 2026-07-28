import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { AcuerdosService } from "./acuerdos.service";
import type { Acuerdo } from "./acuerdos.types";
import type { FirmaStatus } from "./firmas.repository";

export type ExportResponse = {
  setHeader(name: string, value: string): void;
};

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

  @Get("casos/:casoId/acuerdo")
  getForCaso(
    @Param("casoId") casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<{ acuerdo: Acuerdo; firmas: FirmaStatus[] }> {
    return this.acuerdosService.getForCaso(casoId, caller.id);
  }

  @Post("acuerdos/:id/firmar")
  sendToSignature(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<Acuerdo> {
    return this.acuerdosService.sendToSignature(id, caller.id);
  }

  @Get("acuerdos/:id/exportar")
  @Header("Content-Type", "text/plain; charset=utf-8")
  async exportAgreement(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Res({ passthrough: true }) response: ExportResponse,
  ): Promise<string> {
    const exported = await this.acuerdosService.exportAgreement(id, caller.id);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${exported.filename}"`,
    );
    return exported.document;
  }
}
