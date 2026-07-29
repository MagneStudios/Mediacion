import { Inject, Injectable, Logger } from "@nestjs/common";
import { TareasService } from "../../tareas/tareas.service";
import { AcuerdosRepository } from "../acuerdos.repository";
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
      await this.generateAccionables(firma.acuerdo_id);
    }
  }

  private async reconcileSignedAcuerdo(acuerdoId: string): Promise<void> {
    const allSigned =
      await this.firmasRepository.allSignedForAcuerdo(acuerdoId);
    if (allSigned) {
      await this.generateAccionables(acuerdoId);
    }
  }

  private async generateAccionables(acuerdoId: string): Promise<void> {
    try {
      const acuerdo = await this.acuerdosRepository.findById(acuerdoId);
      if (!acuerdo) {
        return;
      }
      await this.tareasService.generateForAcuerdo(
        acuerdo.id,
        acuerdo.caso_id,
        acuerdo.contenido,
      );
    } catch (error) {
      this.logger.error(
        `RN-14 accionable generation failed for acuerdo ${acuerdoId}`,
        error,
      );
    }
  }
}
