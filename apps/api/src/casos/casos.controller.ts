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
import type { CategoriaItem } from "../items/items.types";
import { CasosService } from "./casos.service";
import type {
  CaseCreated,
  CaseDetail,
  CaseEstado,
  CaseSummary,
  CreateCasoDto,
  EstadoCasoDto,
  PlazoDto,
  PlazoState,
} from "./casos.types";

@Controller("casos")
export class CasosController {
  constructor(
    @Inject(CasosService) private readonly casosService: CasosService,
  ) {}

  @Post()
  createCase(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: CreateCasoDto,
  ): Promise<CaseCreated> {
    return this.casosService.createCase(caller.id, body);
  }

  @Get()
  listOwnCases(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CaseSummary[]> {
    return this.casosService.listOwnCases(caller.id);
  }

  @Get(":id")
  getCaseDetail(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CaseDetail> {
    return this.casosService.getCaseDetail(id, caller.id);
  }

  @Patch(":id/plazo")
  setPlazo(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: PlazoDto,
  ): Promise<PlazoState> {
    return this.casosService.setPlazo(id, caller.id, body);
  }

  @Get(":id/plazo")
  getPlazo(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PlazoState> {
    return this.casosService.getPlazo(id, caller.id);
  }

  @Patch(":id/estado")
  setEstado(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: EstadoCasoDto,
  ): Promise<CaseEstado> {
    return this.casosService.setEstado(id, caller.id, body);
  }

  @Get(":id/categorias")
  listCategorias(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CategoriaItem[]> {
    return this.casosService.listCategorias(id, caller.id);
  }
}
