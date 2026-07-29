import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  estadoAcuerdoConAviso,
  estadoAcuerdoFirmado,
} from "../acuerdos/acuerdos.types";
import type { CasoParteMembership } from "../casos/casos.types";
import { MembershipService } from "../casos/membership.service";
import { IncumplimientosRepository } from "./incumplimientos.repository";
import type {
  AcuerdoForBreach,
  IncumplimientoView,
  RegisterIncumplimientoDto,
} from "./incumplimientos.types";

const breachableEstados: AcuerdoForBreach["estado"][] = [
  estadoAcuerdoFirmado,
  estadoAcuerdoConAviso,
];

const reportingRoles: CasoParteMembership["rol_en_caso"][] = [
  "parte_a",
  "parte_b",
];

function forbiddenRole(): HttpException {
  return new HttpException(
    {
      code: "forbidden_role",
      message: "Only a party of the case can report a breach",
    },
    HttpStatus.FORBIDDEN,
  );
}

function acuerdoNotFound(): HttpException {
  return new HttpException(
    { code: "acuerdo_not_found", message: "Agreement not found" },
    HttpStatus.NOT_FOUND,
  );
}

function acuerdoNotFirmado(): HttpException {
  return new HttpException(
    {
      code: "acuerdo_not_firmado",
      message: "Only a signed agreement can be reported as breached",
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function assertValidDescripcion(input: RegisterIncumplimientoDto): void {
  if (
    typeof input?.descripcion !== "string" ||
    input.descripcion.trim().length === 0
  ) {
    throw new HttpException(
      { code: "invalid_input", message: "descripcion is required" },
      HttpStatus.BAD_REQUEST,
    );
  }
}

@Injectable()
export class IncumplimientosService {
  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(IncumplimientosRepository)
    private readonly incumplimientosRepository: IncumplimientosRepository,
  ) {}

  async registerBreach(
    acuerdoId: string,
    callerId: string,
    input: RegisterIncumplimientoDto,
  ): Promise<IncumplimientoView> {
    assertValidDescripcion(input);
    const { acuerdo, membership } = await this.loadAccessibleAcuerdo(
      acuerdoId,
      callerId,
    );
    if (!reportingRoles.includes(membership.rol_en_caso)) {
      throw forbiddenRole();
    }
    if (!breachableEstados.includes(acuerdo.estado)) {
      throw acuerdoNotFirmado();
    }
    return this.incumplimientosRepository.registerBreach(
      acuerdoId,
      callerId,
      input.descripcion.trim(),
    );
  }

  async listForAcuerdo(
    acuerdoId: string,
    callerId: string,
  ): Promise<IncumplimientoView[]> {
    await this.loadAccessibleAcuerdo(acuerdoId, callerId);
    return this.incumplimientosRepository.listByAcuerdo(acuerdoId);
  }

  private async loadAccessibleAcuerdo(
    acuerdoId: string,
    callerId: string,
  ): Promise<{
    acuerdo: AcuerdoForBreach;
    membership: CasoParteMembership;
  }> {
    const acuerdo = await this.incumplimientosRepository.findAcuerdo(acuerdoId);
    if (!acuerdo) {
      throw acuerdoNotFound();
    }
    try {
      const membership = await this.membershipService.assertMembership(
        acuerdo.caso_id,
        callerId,
      );
      return { acuerdo, membership };
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.NOT_FOUND
      ) {
        throw acuerdoNotFound();
      }
      throw error;
    }
  }
}
