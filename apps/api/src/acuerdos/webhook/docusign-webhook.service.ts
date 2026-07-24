import { Inject, Injectable, Logger } from "@nestjs/common";
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
    }
  }
}
