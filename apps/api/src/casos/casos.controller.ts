import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { CasosService } from "./casos.service";
import type {
  CaseCreated,
  CaseDetail,
  CaseSummary,
  CreateCasoDto,
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
}
