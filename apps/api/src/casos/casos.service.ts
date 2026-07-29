import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CategoriaItem } from "../items/items.types";
import { PlanLimitService } from "../pagos/plan-limit.service";
import { CasosRepository } from "./casos.repository";
import type {
  CaseCreated,
  CaseDetail,
  CaseEstado,
  CaseSummary,
  Caso,
  Contraparte,
  ContraparteByCaso,
  CreateCasoDto,
  EstadoCasoDto,
  MetodoCaso,
  PlazoDto,
  PlazoState,
  Semaforo,
} from "./casos.types";
import { estadoCasoTerminado } from "./casos.types";
import { categoriasBase } from "./categorias";
import { MembershipService } from "./membership.service";
import { computeSemaforo } from "./semaforo";

const validMetodos: MetodoCaso[] = ["negociacion", "conciliacion", "mediacion"];

function assertValidEstadoTransition(input: EstadoCasoDto): void {
  if (input?.estado !== estadoCasoTerminado) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: `estado must be ${estadoCasoTerminado}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

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

/**
 * TIMESTAMPTZ columns are typed as string but node-postgres hands back a Date at
 * runtime, so both shapes have to survive this conversion.
 */
function semaforoOf(
  plazo: Caso["plazo"] | undefined,
  now: Date,
): Semaforo | null {
  if (plazo === null || plazo === undefined) {
    return null;
  }
  return computeSemaforo(new Date(plazo), now);
}

function contraparteOf(
  contrapartes: ContraparteByCaso[],
  casoId: string,
): Contraparte | null {
  const match = contrapartes.find((row) => row.caso_id === casoId);
  if (!match) {
    return null;
  }
  return {
    usuario_id: match.usuario_id,
    rol_en_caso: match.rol_en_caso,
    nombre: match.nombre,
    apellido: match.apellido,
  };
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

  async listOwnCases(callerId: string): Promise<CaseSummary[]> {
    const rows = await this.casosRepository.findOwnCases(callerId);
    if (rows.length === 0) {
      return [];
    }
    const contrapartes = await this.casosRepository.findContrapartes(
      rows.map((row) => row.id),
      callerId,
    );
    const now = new Date();
    return rows.map((row) => ({
      ...row,
      semaforo: semaforoOf(row.plazo, now),
      contraparte: contraparteOf(contrapartes, row.id),
    }));
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
    const contrapartes = await this.casosRepository.findContrapartes(
      [casoId],
      callerId,
    );
    return {
      ...detail,
      semaforo: semaforoOf(detail.plazo, new Date()),
      contraparte: contraparteOf(contrapartes, casoId),
    };
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

  async setEstado(
    casoId: string,
    callerId: string,
    input: EstadoCasoDto,
  ): Promise<CaseEstado> {
    assertValidEstadoTransition(input);
    await this.membershipService.assertMembership(casoId, callerId);
    return this.casosRepository.updateEstado(casoId, input.estado);
  }

  async listCategorias(
    casoId: string,
    callerId: string,
  ): Promise<CategoriaItem[]> {
    await this.membershipService.assertMembership(casoId, callerId);
    return [...categoriasBase];
  }
}
