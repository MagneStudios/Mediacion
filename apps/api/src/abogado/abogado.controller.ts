import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbogadoService } from "./abogado.service";
import type {
  SolicitudAbogadoCheckout,
  SolicitudAbogadoView,
} from "./abogado.types";

@Controller()
export class AbogadoController {
  constructor(
    @Inject(AbogadoService) private readonly abogadoService: AbogadoService,
  ) {}

  @Post("casos/:casoId/solicitud-abogado")
  requestAbogado(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<SolicitudAbogadoCheckout> {
    return this.abogadoService.requestForCaso(casoId, caller.id);
  }

  @Get("casos/:casoId/solicitud-abogado")
  getAbogado(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<SolicitudAbogadoView> {
    return this.abogadoService.getForCaso(casoId, caller.id);
  }
}
