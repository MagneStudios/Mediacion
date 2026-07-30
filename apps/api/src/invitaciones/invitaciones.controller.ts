import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { InvitacionesService } from "./invitaciones.service";
import type {
  CreateInvitacionDto,
  InvitacionCreated,
  InvitacionView,
  JoinCasoDto,
  JoinedCaso,
} from "./invitaciones.types";

@Controller("casos")
export class InvitacionesController {
  constructor(
    @Inject(InvitacionesService)
    private readonly invitacionesService: InvitacionesService,
  ) {}

  @Post(":id/invitaciones")
  createInvitation(
    @Param("id") casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: CreateInvitacionDto,
  ): Promise<InvitacionCreated> {
    return this.invitacionesService.createInvitation(casoId, caller.id, body);
  }

  @Post("unirse")
  joinCase(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: JoinCasoDto,
  ): Promise<JoinedCaso> {
    return this.invitacionesService.joinCase(
      body.token,
      caller.id,
      caller.email,
    );
  }

  @Get(":id/invitaciones")
  listInvitations(
    @Param("id") casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<InvitacionView[]> {
    return this.invitacionesService.listForCaso(casoId, caller.id);
  }
}
