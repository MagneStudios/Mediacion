import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  docusignStatusDeclined,
  docusignStatusDelivered,
  docusignStatusSent,
  docusignStatusSigned,
  docusignStatusVoided,
} from "../acuerdos.types";
import type {
  SignnowDocument,
  SignnowFieldInvite,
} from "../signnow/http-signnow-client";
import { HttpSignnowClient } from "../signnow/http-signnow-client";
import { isRegressiveStatusTransition } from "./docusign-status-precedence";
import { DocusignWebhookService } from "./docusign-webhook.service";

export type SignnowCallbackPayload = {
  meta?: { event?: string };
  event?: string;
  entity_id?: string | number;
  document_id?: string | number;
  content?: { document_id?: string | number; entity_id?: string | number };
};

const fieldInviteStatusFulfilled = "fulfilled";
const fieldInviteStatusDeclined = "declined";
const fieldInviteViewedStatuses = new Set(["opened", "viewed", "seen"]);
const fieldInviteVoidedStatuses = new Set([
  "expired",
  "cancelled",
  "revoked",
  "skipped",
]);
const fieldInviteSentStatuses = new Set(["created", "pending", "sent"]);

const mappingLogger = new Logger("SignnowWebhookService");

type SignerStatus = {
  recipientEmail: string;
  status: string;
};

function mapFieldInviteStatus(invite: SignnowFieldInvite): string {
  const status = invite.status?.toLowerCase() ?? "";
  if (status === fieldInviteStatusFulfilled) {
    return docusignStatusSigned;
  }
  if (status === fieldInviteStatusDeclined) {
    return docusignStatusDeclined;
  }
  if (fieldInviteViewedStatuses.has(status)) {
    return docusignStatusDelivered;
  }
  if (fieldInviteVoidedStatuses.has(status)) {
    return docusignStatusVoided;
  }
  if (!fieldInviteSentStatuses.has(status)) {
    mappingLogger.warn(
      `Unknown signNow field_invite status "${status}"; defaulting to ${docusignStatusSent}`,
    );
  }
  return docusignStatusSent;
}

/**
 * Merges a signer's status only when the incoming one has higher precedence
 * (pending < sent < delivered < signed; declined/voided are terminal), so a
 * lower-precedence field_invite never downgrades a freeform request's status.
 */
function mergeSignerStatus(
  statusByEmail: Map<string, string>,
  email: string,
  incomingStatus: string,
): void {
  const normalizedEmail = email.toLowerCase();
  const storedStatus = statusByEmail.get(normalizedEmail);
  if (
    storedStatus !== undefined &&
    isRegressiveStatusTransition(storedStatus, incomingStatus)
  ) {
    return;
  }
  statusByEmail.set(normalizedEmail, incomingStatus);
}

export function mapSignnowDocumentToSignerStatuses(
  document: SignnowDocument,
): SignerStatus[] {
  const statusByEmail = new Map<string, string>();
  for (const request of document.requests ?? []) {
    if (typeof request.signer_email !== "string") {
      continue;
    }
    const signed =
      typeof request.signature_id === "string" &&
      request.signature_id.length > 0;
    mergeSignerStatus(
      statusByEmail,
      request.signer_email,
      signed ? docusignStatusSigned : docusignStatusSent,
    );
  }
  for (const invite of document.field_invites ?? []) {
    if (typeof invite.email !== "string") {
      continue;
    }
    mergeSignerStatus(
      statusByEmail,
      invite.email,
      mapFieldInviteStatus(invite),
    );
  }
  return [...statusByEmail.entries()].map(([recipientEmail, status]) => ({
    recipientEmail,
    status,
  }));
}

function extractDocumentId(
  payload: SignnowCallbackPayload,
): string | undefined {
  const candidates = [
    payload.content?.document_id,
    payload.content?.entity_id,
    payload.document_id,
    payload.entity_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
    if (typeof candidate === "number") {
      return String(candidate);
    }
  }
  return undefined;
}

@Injectable()
export class SignnowWebhookService {
  private readonly logger = new Logger(SignnowWebhookService.name);

  constructor(
    @Inject(HttpSignnowClient)
    private readonly signnowClient: HttpSignnowClient,
    @Inject(DocusignWebhookService)
    private readonly docusignWebhookService: DocusignWebhookService,
  ) {}

  /**
   * Never trusts the callback payload beyond the document id: re-fetches the
   * document from signNow and derives each signer's status from its invites.
   */
  async processCallback(payload: SignnowCallbackPayload): Promise<void> {
    const documentId = extractDocumentId(payload);
    if (!documentId) {
      this.logger.warn(
        "signNow callback did not include a document id; ignoring",
      );
      return;
    }
    const document = await this.signnowClient.getDocument(documentId);
    const signerStatuses = mapSignnowDocumentToSignerStatuses(document);
    const eventName = payload.meta?.event ?? payload.event ?? "signnow";
    for (const signerStatus of signerStatuses) {
      await this.docusignWebhookService.applyEvent({
        envelopeId: documentId,
        recipientEmail: signerStatus.recipientEmail,
        status: signerStatus.status,
        event: eventName,
      });
    }
  }
}
