import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { NegociacionService } from "./negociacion.service";
import type {
  NegociacionView,
  PropuestaDetail,
  PropuestaView,
  RenegociacionView,
  RespuestaDto,
} from "./negociacion.types";

@Controller()
export class NegociacionController {
  constructor(
    @Inject(NegociacionService)
    private readonly negociacionService: NegociacionService,
  ) {}

  @Post("casos/:casoId/propuestas")
  createPropuesta(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PropuestaView> {
    return this.negociacionService.generatePropuesta(casoId, caller.id);
  }

  @Post("propuestas/:id/responder")
  responderPropuesta(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: RespuestaDto,
  ): Promise<PropuestaView> {
    return this.negociacionService.responder(id, caller.id, body.decision);
  }

  @Get("casos/:casoId/propuestas")
  listPropuestas(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PropuestaDetail[]> {
    return this.negociacionService.listPropuestas(casoId, caller.id);
  }

  @Post("negociaciones/:id/renegociar")
  renegociar(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<RenegociacionView> {
    return this.negociacionService.renegociar(id, caller.id);
  }

  @Get("casos/:casoId/negociaciones")
  listNegociaciones(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<NegociacionView[]> {
    return this.negociacionService.listNegociaciones(casoId, caller.id);
  }
}
