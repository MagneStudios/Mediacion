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
import { CasosService } from "./casos.service";
import type {
  CaseCreated,
  CaseDetail,
  CaseSummary,
  CreateCasoDto,
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
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CaseDetail> {
    return this.casosService.getCaseDetail(id, caller.id);
  }

  @Patch(":id/plazo")
  setPlazo(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: PlazoDto,
  ): Promise<PlazoState> {
    return this.casosService.setPlazo(id, caller.id, body);
  }

  @Get(":id/plazo")
  getPlazo(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<PlazoState> {
    return this.casosService.getPlazo(id, caller.id);
  }
}
