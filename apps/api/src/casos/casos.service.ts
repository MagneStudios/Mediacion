import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { PlanLimitService } from "../pagos/plan-limit.service";
import { CasosRepository } from "./casos.repository";
import type {
  CaseCreated,
  CaseDetail,
  CaseSummary,
  CreateCasoDto,
  MetodoCaso,
  PlazoDto,
  PlazoState,
} from "./casos.types";
import { MembershipService } from "./membership.service";
import { computeSemaforo } from "./semaforo";

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

function assertValidPlazo(input: PlazoDto, now: Date): Date {
  const plazo = typeof input?.plazo === "string" ? new Date(input.plazo) : null;
  if (plazo === null || Number.isNaN(plazo.getTime())) {
    throw new HttpException(
      { code: "invalid_input", message: "plazo must be a valid ISO date" },
      HttpStatus.BAD_REQUEST,
    );
  }
  if (plazo.getTime() <= now.getTime()) {
    throw new HttpException(
      { code: "invalid_input", message: "plazo must be in the future" },
      HttpStatus.BAD_REQUEST,
    );
  }
  return plazo;
}

@Injectable()
export class CasosService {
  constructor(
    @Inject(CasosRepository) private readonly casosRepository: CasosRepository,
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(PlanLimitService)
    private readonly planLimitService: PlanLimitService,
  ) {}

  async createCase(
    callerId: string,
    input: CreateCasoDto,
  ): Promise<CaseCreated> {
    assertValidCreateInput(input);
    await this.planLimitService.assertCanCreateCase(callerId);
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

  async setPlazo(
    casoId: string,
    callerId: string,
    input: PlazoDto,
  ): Promise<PlazoState> {
    const now = new Date();
    const plazo = assertValidPlazo(input, now);
    await this.membershipService.assertMembership(casoId, callerId);
    const updated = await this.casosRepository.updatePlazo(
      casoId,
      plazo.toISOString(),
    );
    return {
      id: updated.id,
      plazo: updated.plazo,
      semaforo: computeSemaforo(
        updated.plazo === null ? null : new Date(updated.plazo),
        now,
      ),
    };
  }

  async getPlazo(casoId: string, callerId: string): Promise<PlazoState> {
    await this.membershipService.assertMembership(casoId, callerId);
    const row = await this.casosRepository.findPlazo(casoId);
    if (!row) {
      throw new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    const now = new Date();
    return {
      id: row.id,
      plazo: row.plazo,
      semaforo: computeSemaforo(
        row.plazo === null ? null : new Date(row.plazo),
        now,
      ),
    };
  }
}
