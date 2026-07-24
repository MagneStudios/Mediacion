import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { CasosRepository } from "../casos/casos.repository";
import type { CaseDetail } from "../casos/casos.types";
import { MembershipService } from "../casos/membership.service";
import { KYSELY } from "../database/database.tokens";
import { AcuerdosRepository } from "./acuerdos.repository";
import type { Acuerdo } from "./acuerdos.types";
import { buildAgreementContent } from "./agreement-content";
import { readAcceptedPropuesta } from "./propuesta-read.query";

const estadoCasoAcordado: CaseDetail["estado"] = "acordado";

function casoNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

function casoNotAcordado(): HttpException {
  return new HttpException(
    { code: "caso_not_acordado", message: "Case must be in acordado state" },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

@Injectable()
export class AcuerdosService {
  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(CasosRepository) private readonly casosRepository: CasosRepository,
    @Inject(AcuerdosRepository)
    private readonly acuerdosRepository: AcuerdosRepository,
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
  ) {}

  async generateAgreement(casoId: string, callerId: string): Promise<Acuerdo> {
    await this.membershipService.assertMembership(casoId, callerId);
    const caso = await this.casosRepository.findDetailForMember(
      casoId,
      callerId,
    );
    if (!caso) {
      throw casoNotFound();
    }
    if (caso.estado !== estadoCasoAcordado) {
      throw casoNotAcordado();
    }
    const accepted = await readAcceptedPropuesta(this.kysely, casoId);
    const contenido = buildAgreementContent(accepted);
    return this.acuerdosRepository.insertDraft(casoId, contenido);
  }
}
