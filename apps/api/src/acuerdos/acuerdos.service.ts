import type { Database } from "@mediacion/db-types";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { Kysely } from "kysely";
import { CasosRepository } from "../casos/casos.repository";
import type { CaseDetail } from "../casos/casos.types";
import { MembershipService } from "../casos/membership.service";
import { KYSELY } from "../database/database.tokens";
import { AcuerdosRepository } from "./acuerdos.repository";
import type { Acuerdo } from "./acuerdos.types";
import { buildAgreementContent } from "./agreement-content";
import type { DocusignClient } from "./docusign/docusign-client";
import { DOCUSIGN_CLIENT } from "./docusign/docusign-client";
import { readAcceptedFirmantes } from "./firmantes-read.query";
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

function acuerdoNotFound(): HttpException {
  return new HttpException(
    { code: "acuerdo_not_found", message: "Agreement not found" },
    HttpStatus.NOT_FOUND,
  );
}

@Injectable()
export class AcuerdosService {
  private readonly logger = new Logger(AcuerdosService.name);

  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(CasosRepository) private readonly casosRepository: CasosRepository,
    @Inject(AcuerdosRepository)
    private readonly acuerdosRepository: AcuerdosRepository,
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
    @Inject(DOCUSIGN_CLIENT)
    private readonly docusignClient: DocusignClient,
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

  async sendToSignature(acuerdoId: string, callerId: string): Promise<Acuerdo> {
    const acuerdo = await this.acuerdosRepository.findById(acuerdoId);
    if (!acuerdo) {
      throw acuerdoNotFound();
    }
    await this.membershipService.assertMembership(acuerdo.caso_id, callerId);
    await this.acuerdosRepository.claimForSignature(acuerdoId);
    let envelopeId: string | null = null;
    try {
      const firmantes = await readAcceptedFirmantes(
        this.kysely,
        acuerdo.caso_id,
      );
      const signers = firmantes.map((firmante) => ({
        usuarioId: firmante.usuario_id,
        email: firmante.email,
        name: `${firmante.nombre} ${firmante.apellido}`,
      }));
      const envelope = await this.docusignClient.createEnvelope({
        acuerdoId,
        signers,
      });
      envelopeId = envelope.envelopeId;
      return await this.acuerdosRepository.persistSignatureEnvelope(
        acuerdoId,
        envelopeId,
        signers.map((signer) => signer.usuarioId),
      );
    } catch (error) {
      await this.compensateFailedSignature(acuerdoId, envelopeId, error);
      throw error;
    }
  }

  private async compensateFailedSignature(
    acuerdoId: string,
    envelopeId: string | null,
    originalError: unknown,
  ): Promise<void> {
    try {
      await this.acuerdosRepository.revertClaimToBorrador(acuerdoId);
    } catch (revertError) {
      this.logger.error(
        `revert claim failed for acuerdo ${acuerdoId}`,
        revertError,
      );
    }
    if (envelopeId !== null) {
      this.logger.error(
        `DocuSign envelope ${envelopeId} created but not persisted for acuerdo ${acuerdoId}`,
        originalError,
      );
    }
  }
}
