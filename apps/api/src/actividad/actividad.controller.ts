import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { ActividadService } from "./actividad.service";
import type { ActivityEvent } from "./actividad.types";

@Controller()
export class ActividadController {
  constructor(
    @Inject(ActividadService)
    private readonly actividadService: ActividadService,
  ) {}

  @Get("casos/:casoId/actividad")
  listForCaso(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<ActivityEvent[]> {
    return this.actividadService.listForCaso(casoId, caller.id);
  }

  @Get("acuerdos/:id/historial")
  listForAcuerdo(
    @Param("id", ParseUUIDPipe) acuerdoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<ActivityEvent[]> {
    return this.actividadService.listForAcuerdo(acuerdoId, caller.id);
  }
}
