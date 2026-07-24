import { Controller, Get, Inject, Query } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { AuditoriaService } from "./auditoria.service";
import type { ListAuditoriaQuery, ListAuditoriaResult } from "./types";

@Controller("auditoria")
export class AuditoriaController {
  constructor(
    @Inject(AuditoriaService)
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Roles("admin")
  listAuditoria(
    @Query() query: ListAuditoriaQuery,
  ): Promise<ListAuditoriaResult> {
    return this.auditoriaService.listAuditoria(query);
  }
}
