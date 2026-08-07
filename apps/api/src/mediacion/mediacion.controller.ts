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
import { Roles } from "../auth/roles.decorator";
import { MediacionService } from "./mediacion.service";
import type {
  CreateMediacionDto,
  MediacionView,
  MediadorOption,
  UpdateMediacionEstadoDto,
} from "./mediacion.types";

@Controller()
export class MediacionController {
  constructor(
    @Inject(MediacionService)
    private readonly mediacionService: MediacionService,
  ) {}

  @Get("casos/:casoId/mediacion")
  getForCaso(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<MediacionView | null> {
    return this.mediacionService.getForCaso(casoId, caller.id);
  }

  @Get("casos/:casoId/mediadores")
  listMediadores(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<MediadorOption[]> {
    return this.mediacionService.listMediadoresForCaso(casoId, caller.id);
  }

  @Post("casos/:casoId/mediacion")
  requestMediacion(
    @Param("casoId", ParseUUIDPipe) casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: CreateMediacionDto,
  ): Promise<MediacionView> {
    return this.mediacionService.requestMediacion(
      casoId,
      caller.id,
      body.mediadorId,
    );
  }

  @Roles("mediador", "admin")
  @Patch("mediacion/:id")
  updateEstado(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: UpdateMediacionEstadoDto,
  ): Promise<MediacionView> {
    return this.mediacionService.updateEstado(id, caller, body.estado);
  }
}
