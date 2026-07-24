import { Inject, Injectable } from "@nestjs/common";
import { AuditoriaRepository } from "./auditoria.repository";
import { resolvePagination } from "./pagination";
import type { ListAuditoriaQuery, ListAuditoriaResult } from "./types";

@Injectable()
export class AuditoriaService {
  constructor(
    @Inject(AuditoriaRepository)
    private readonly auditoriaRepository: AuditoriaRepository,
  ) {}

  async listAuditoria(query: ListAuditoriaQuery): Promise<ListAuditoriaResult> {
    const { page, limit } = resolvePagination(query);
    const offset = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.auditoriaRepository.findPage(offset, limit),
      this.auditoriaRepository.count(),
    ]);
    return { items, page, limit, total };
  }
}
