import { Body, Controller, Inject, Param, Patch, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { MediacionService } from "./mediacion.service";
import type {
  CreateMediacionDto,
  MediacionView,
  UpdateMediacionEstadoDto,
} from "./mediacion.types";

@Controller()
export class MediacionController {
  constructor(
    @Inject(MediacionService)
    private readonly mediacionService: MediacionService,
  ) {}

  @Post("casos/:casoId/mediacion")
  requestMediacion(
    @Param("casoId") casoId: string,
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
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: UpdateMediacionEstadoDto,
  ): Promise<MediacionView> {
    return this.mediacionService.updateEstado(id, caller, body.estado);
  }
}
