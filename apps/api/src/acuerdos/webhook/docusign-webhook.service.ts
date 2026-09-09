import { Inject, Injectable, Logger } from "@nestjs/common";
import { CasosRepository } from "../../casos/casos.repository";
import { TareasService } from "../../tareas/tareas.service";
import { AcuerdosRepository } from "../acuerdos.repository";
import type { Acuerdo } from "../acuerdos.types";
import { docusignStatusSigned } from "../acuerdos.types";
import { FirmasRepository } from "../firmas.repository";
import { isRegressiveStatusTransition } from "./docusign-status-precedence";

export type DocusignWebhookEvent = {
  envelopeId: string;
  recipientEmail: string;
  status: string;
  event: string;
};

@Injectable()
export class DocusignWebhookService {
  private readonly logger = new Logger(DocusignWebhookService.name);

  constructor(
    @Inject(FirmasRepository)
    private readonly firmasRepository: FirmasRepository,
    @Inject(AcuerdosRepository)
    private readonly acuerdosRepository: AcuerdosRepository,
    @Inject(TareasService)
    private readonly tareasService: TareasService,
    @Inject(CasosRepository)
    private readonly casosRepository: CasosRepository,
  ) {}

  async applyEvent(event: DocusignWebhookEvent): Promise<void> {
    const firma = await this.firmasRepository.findByEnvelopeAndEmail(
      event.envelopeId,
      event.recipientEmail,
    );
    if (!firma) {
      return;
    }
    if (firma.docusign_status === event.status) {
      if (event.status === docusignStatusSigned) {
        await this.reconcileSignedAcuerdo(firma.acuerdo_id);
      }
      return;
    }
    if (isRegressiveStatusTransition(firma.docusign_status, event.status)) {
      this.logger.warn(
        `Ignoring regressive DocuSign status for envelope ${event.envelopeId}: stored=${firma.docusign_status} incoming=${event.status}`,
      );
      return;
    }
    await this.firmasRepository.updateStatus(firma.id, event.status);
    if (event.status !== docusignStatusSigned) {
      return;
    }
    const allSigned = await this.firmasRepository.allSignedForAcuerdo(
      firma.acuerdo_id,
    );
    if (allSigned) {
      await this.acuerdosRepository.markFirmado(firma.acuerdo_id);
      await this.settleSignedAcuerdo(firma.acuerdo_id);
    }
  }

  private async reconcileSignedAcuerdo(acuerdoId: string): Promise<void> {
    const allSigned =
      await this.firmasRepository.allSignedForAcuerdo(acuerdoId);
    if (allSigned) {
      await this.settleSignedAcuerdo(acuerdoId);
    }
  }

  /**
   * Everything a fully signed acuerdo triggers, in the order that survives a
   * partial failure. `recomputeAcordado` runs first and is allowed to throw:
   * the caso's state is the legally meaningful one, so a failure here should
   * fail the callback and let the provider retry — both steps are idempotent.
   * It also runs on the reconcile path, or a replayed callback would leave a
   * caso whose materias are all signed still reading `en_negociacion`.
   */
  private async settleSignedAcuerdo(acuerdoId: string): Promise<void> {
    const acuerdo = await this.acuerdosRepository.findById(acuerdoId);
    if (!acuerdo) {
      return;
    }
    await this.casosRepository.recomputeAcordado(acuerdo.caso_id);
    await this.generateAccionables(acuerdo);
  }

  private async generateAccionables(acuerdo: Acuerdo): Promise<void> {
    try {
      await this.tareasService.generateForAcuerdo(
        acuerdo.id,
        acuerdo.caso_id,
        acuerdo.contenido,
      );
    } catch (error) {
      this.logger.error(
        `RN-14 accionable generation failed for acuerdo ${acuerdo.id}`,
        error,
      );
    }
  }
}
