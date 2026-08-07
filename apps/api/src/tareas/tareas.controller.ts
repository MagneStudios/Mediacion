import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { TareasService } from "./tareas.service";
import type {
  CalendarEventDto,
  TareaCalendarEvent,
  TareaView,
  UpdateTareaEstadoDto,
} from "./tareas.types";

@Controller()
export class TareasController {
  constructor(
    @Inject(TareasService) private readonly tareasService: TareasService,
  ) {}

  @Get("casos/:casoId/tareas")
  listForCaso(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<TareaView[]> {
    return this.tareasService.listForCaso(casoId, caller.id);
  }

  @Patch("tareas/:id")
  updateEstado(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: UpdateTareaEstadoDto,
  ): Promise<TareaView> {
    return this.tareasService.updateEstado(id, caller.id, body);
  }

  @Post("tareas/:id/calendario")
  addToCalendar(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: CalendarEventDto,
  ): Promise<TareaCalendarEvent> {
    return this.tareasService.addToCalendar(id, caller.id, body);
  }
}
