import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import type {
  CreateSuscripcionDto,
  SuscripcionCancelada,
  SuscripcionCreated,
} from "./pagos.types";
import { SuscripcionesService } from "./suscripciones.service";

@Controller("suscripciones")
export class SuscripcionesController {
  constructor(
    @Inject(SuscripcionesService)
    private readonly suscripcionesService: SuscripcionesService,
  ) {}

  @Post()
  createSuscripcion(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: CreateSuscripcionDto,
  ): Promise<SuscripcionCreated> {
    return this.suscripcionesService.createSuscripcion(caller.id, body);
  }

  @Post(":id/baja")
  cancelSuscripcion(
    @CurrentUser() caller: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<SuscripcionCancelada> {
    return this.suscripcionesService.cancelSuscripcion(caller, id);
  }
}
