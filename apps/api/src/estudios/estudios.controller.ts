import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { EstudiosService } from "./estudios.service";
import type {
  CarpetaCreated,
  CasosByCarpeta,
  CreateCarpetaDto,
  MarcaConfig,
} from "./estudios.types";

@Controller("estudios")
@Roles("estudio", "admin")
export class EstudiosController {
  constructor(
    @Inject(EstudiosService)
    private readonly estudiosService: EstudiosService,
  ) {}

  @Get(":id/casos")
  listCasos(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CasosByCarpeta[]> {
    return this.estudiosService.listCasos(caller.id, caller.rol, id);
  }

  @Post(":id/carpetas")
  createCarpeta(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: CreateCarpetaDto,
  ): Promise<CarpetaCreated> {
    return this.estudiosService.createCarpeta(caller.id, caller.rol, id, body);
  }

  @Get(":id")
  getMarcaConfig(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<{ marca_config: MarcaConfig }> {
    return this.estudiosService.getMarcaConfig(caller.id, caller.rol, id);
  }

  @Patch(":id/marca-config")
  updateMarcaConfig(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<{ marca_config: MarcaConfig }> {
    return this.estudiosService.updateMarcaConfig(
      caller.id,
      caller.rol,
      id,
      body,
    );
  }
}
