import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { CasosRepository } from "./casos.repository";
import type {
  CaseCreated,
  CaseDetail,
  CaseSummary,
  CreateCasoDto,
  MetodoCaso,
} from "./casos.types";
import { MembershipService } from "./membership.service";

const validMetodos: MetodoCaso[] = ["negociacion", "conciliacion", "mediacion"];

function assertValidCreateInput(input: CreateCasoDto): void {
  if (typeof input?.nombre !== "string" || input.nombre.trim().length === 0) {
    throw new HttpException(
      { code: "invalid_input", message: "nombre is required" },
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!validMetodos.includes(input.metodo)) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: `metodo must be one of ${validMetodos.join(", ")}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

@Injectable()
export class CasosService {
  constructor(
    @Inject(CasosRepository) private readonly casosRepository: CasosRepository,
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
  ) {}

  async createCase(
    callerId: string,
    input: CreateCasoDto,
  ): Promise<CaseCreated> {
    assertValidCreateInput(input);
    const caso = await this.casosRepository.createCaseWithParteA(
      input,
      callerId,
    );
    return { id: caso.id, estado: caso.estado };
  }

  listOwnCases(callerId: string): Promise<CaseSummary[]> {
    return this.casosRepository.findOwnCases(callerId);
  }

  async getCaseDetail(casoId: string, callerId: string): Promise<CaseDetail> {
    await this.membershipService.assertMembership(casoId, callerId);
    const detail = await this.casosRepository.findDetailForMember(
      casoId,
      callerId,
    );
    if (!detail) {
      throw new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return detail;
  }
}
