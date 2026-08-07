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
import { IncumplimientosService } from "./incumplimientos.service";
import type {
  IncumplimientoView,
  RegisterIncumplimientoDto,
} from "./incumplimientos.types";

@Controller()
export class IncumplimientosController {
  constructor(
    @Inject(IncumplimientosService)
    private readonly incumplimientosService: IncumplimientosService,
  ) {}

  @Post("acuerdos/:id/incumplimiento")
  registerBreach(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: RegisterIncumplimientoDto,
  ): Promise<IncumplimientoView> {
    return this.incumplimientosService.registerBreach(id, caller.id, body);
  }

  @Get("acuerdos/:id/incumplimientos")
  listForAcuerdo(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<IncumplimientoView[]> {
    return this.incumplimientosService.listForAcuerdo(id, caller.id);
  }
}
