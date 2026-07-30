import { Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { AvisosService } from "./avisos.service";
import type { NotificacionView, UnreadCount } from "./notificaciones.types";

@Controller("notificaciones")
export class AvisosController {
  constructor(
    @Inject(AvisosService) private readonly avisosService: AvisosService,
  ) {}

  @Get()
  listOwn(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<NotificacionView[]> {
    return this.avisosService.listOwn(caller.id);
  }

  @Get("no-leidas")
  countOwnUnread(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UnreadCount> {
    return this.avisosService.countOwnUnread(caller.id);
  }

  @Patch(":id/leida")
  markOwnRead(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<NotificacionView> {
    return this.avisosService.markOwnRead(id, caller.id);
  }

  @Post("leidas")
  markAllOwnRead(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UnreadCount> {
    return this.avisosService.markAllOwnRead(caller.id);
  }
}
