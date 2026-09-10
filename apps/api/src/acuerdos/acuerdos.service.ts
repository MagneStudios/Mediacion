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
import { MembershipService } from "../casos/membership.service";
import { normalizeTimestamp } from "../common/db/timestamp";
import { KYSELY } from "../database/database.tokens";
import { AcuerdoAccessService } from "./acuerdo-access.service";
import {
  agreementDocumentFilename,
  buildAgreementDocument,
} from "./acuerdo-export";
import {
  AcuerdosRepository,
  acuerdoAlreadyExists,
} from "./acuerdos.repository";
import type {
  Acuerdo,
  AcuerdoExport,
  FirmaView,
  SignatureInboxEntry,
} from "./acuerdos.types";
import { buildAgreementContent } from "./agreement-content";
import type { DocusignClient } from "./docusign/docusign-client";
import { DOCUSIGN_CLIENT } from "./docusign/docusign-client";
import { readAcceptedFirmantes } from "./firmantes-read.query";
import type { FirmaStatus } from "./firmas.repository";
import { FirmasRepository } from "./firmas.repository";
import { readAcceptedPropuesta } from "./propuesta-read.query";

function casoNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

/**
 * Same `code` as before on purpose — the front already maps it — but the state
 * it reports moved: the gate is now the materia being agreed, not the caso,
 * whose `acordado` is derived from the signatures downstream of this call.
 */
function casoNotAcordado(): HttpException {
  return new HttpException(
    {
      code: "caso_not_acordado",
      message: "No negociacion of this case is in acordada state",
    },
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
    @Inject(AcuerdoAccessService)
    private readonly acuerdoAccessService: AcuerdoAccessService,
    @Inject(FirmasRepository)
    private readonly firmasRepository: FirmasRepository,
  ) {}

  async getForCaso(
    casoId: string,
    callerId: string,
  ): Promise<{ acuerdo: Acuerdo; firmas: FirmaStatus[] }> {
    await this.acuerdoAccessService.assertReadAccess(casoId, callerId);
    const acuerdo = await this.acuerdosRepository.findByCasoId(casoId);
    if (!acuerdo) {
      throw acuerdoNotFound();
    }
    const firmas = await this.firmasRepository.listByAcuerdo(acuerdo.id);
    return { acuerdo, firmas };
  }

  /**
   * The same bundle as getForCaso, addressed by the acuerdo instead of the
   * caso. A caso can hold one acuerdo per negociacion, so the caso id no
   * longer identifies a single acuerdo — this is the route that does.
   */
  async getById(
    acuerdoId: string,
    callerId: string,
  ): Promise<{ acuerdo: Acuerdo; firmas: FirmaStatus[] }> {
    const acuerdo = await this.acuerdosRepository.findById(acuerdoId);
    if (!acuerdo) {
      throw acuerdoNotFound();
    }
    await this.assertAcuerdoReadAccess(acuerdo.caso_id, callerId);
    const firmas = await this.firmasRepository.listByAcuerdo(acuerdo.id);
    return { acuerdo, firmas };
  }

  /**
   * Read access to the acuerdo's own caso, reported as acuerdo_not_found: the
   * caller addressed an acuerdo, so a caso they cannot see must not leak as a
   * different error than one that does not exist.
   */
  private async assertAcuerdoReadAccess(
    casoId: string,
    callerId: string,
  ): Promise<void> {
    try {
      await this.acuerdoAccessService.assertReadAccess(casoId, callerId);
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

  async exportAgreement(
    acuerdoId: string,
    callerId: string,
  ): Promise<AcuerdoExport> {
    const acuerdo = await this.acuerdosRepository.findById(acuerdoId);
    if (!acuerdo) {
      throw acuerdoNotFound();
    }
    await this.assertAcuerdoReadAccess(acuerdo.caso_id, callerId);
    return {
      filename: agreementDocumentFilename(acuerdo.id),
      document: buildAgreementDocument(acuerdo),
    };
  }

  async generateAgreement(casoId: string, callerId: string): Promise<Acuerdo> {
    await this.membershipService.assertMembership(casoId, callerId);
    const caso = await this.casosRepository.findDetailForMember(
      casoId,
      callerId,
    );
    if (!caso) {
      throw casoNotFound();
    }
    const acordadas =
      await this.acuerdosRepository.findNegociacionesAcordadas(casoId);
    if (acordadas.length === 0) {
      throw casoNotAcordado();
    }
    const pendiente = acordadas.find(
      (negociacion) => negociacion.acuerdo_vigente_id === null,
    );
    if (!pendiente) {
      throw acuerdoAlreadyExists();
    }
    const accepted = await readAcceptedPropuesta(
      this.kysely,
      casoId,
      pendiente.id,
    );
    const contenido = buildAgreementContent(accepted);
    return this.acuerdosRepository.insertDraft(casoId, pendiente.id, contenido);
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
        documentText: buildAgreementDocument(acuerdo),
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

  /**
   * Per-signer state for one acuerdo. Access is checked against the acuerdo's
   * own caso, never an id the caller supplied.
   */
  async listFirmas(acuerdoId: string, callerId: string): Promise<FirmaView[]> {
    const acuerdo = await this.acuerdosRepository.findById(acuerdoId);
    if (!acuerdo) {
      throw acuerdoNotFound();
    }
    await this.acuerdoAccessService.assertReadAccess(acuerdo.caso_id, callerId);
    const rows = await this.firmasRepository.listViewByAcuerdo(acuerdoId);
    return rows.map((row) => ({
      ...row,
      fecha_firma: normalizeTimestamp(row.fecha_firma),
    }));
  }

  /**
   * Every acuerdo the caller signs, across all their casos. Scoped by the
   * caller's own firmas rows, so it needs no separate membership check — a row
   * only exists for someone who is party to the acuerdo.
   */
  async listSignatureInbox(callerId: string): Promise<SignatureInboxEntry[]> {
    const rows = await this.firmasRepository.listInboxForUsuario(callerId);
    return rows.map((row) => ({
      ...row,
      own_fecha_firma: normalizeTimestamp(row.own_fecha_firma),
      pending_signers: Number(row.pending_signers),
    }));
  }
}
