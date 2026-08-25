import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";
import { agreementDocumentFilename } from "../acuerdo-export";
import type {
  CreateEnvelopeInput,
  CreateEnvelopeOutput,
  DocusignClient,
} from "../docusign/docusign-client";
import { SignnowTokenClient } from "./signnow-token-client";

const signnowRequestTimeoutMs = 30_000;
const unauthorizedStatus = 401;
const documentTextMimeType = "text/plain";
const webhookAction = "callback";
const webhookEvents = ["document.complete", "document.update"] as const;

const requiredCredentialEnvVars: Array<{
  configKey: keyof Pick<
    AppConfig,
    | "signnowClientId"
    | "signnowClientSecret"
    | "signnowUserEmail"
    | "signnowUserPassword"
  >;
  envVar: string;
}> = [
  { configKey: "signnowClientId", envVar: "SIGNNOW_CLIENT_ID" },
  { configKey: "signnowClientSecret", envVar: "SIGNNOW_CLIENT_SECRET" },
  { configKey: "signnowUserEmail", envVar: "SIGNNOW_USER_EMAIL" },
  { configKey: "signnowUserPassword", envVar: "SIGNNOW_USER_PASSWORD" },
];

type SignnowUploadResponse = {
  id?: string;
};

export type SignnowDocumentRequest = {
  signer_email?: string;
  signature_id?: string | null;
};

export type SignnowFieldInvite = {
  email?: string;
  status?: string;
};

export type SignnowDocument = {
  requests?: SignnowDocumentRequest[];
  field_invites?: SignnowFieldInvite[];
};

@Injectable()
export class HttpSignnowClient implements DocusignClient {
  private readonly logger = new Logger(HttpSignnowClient.name);
  private readonly tokenClient: SignnowTokenClient;

  constructor(
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    tokenClient?: SignnowTokenClient,
  ) {
    this.tokenClient = tokenClient ?? new SignnowTokenClient(appConfig);
  }

  async createEnvelope(
    input: CreateEnvelopeInput,
  ): Promise<CreateEnvelopeOutput> {
    this.assertCredentialsConfigured();
    if (input.signers.length === 0) {
      throw new Error("signNow envelope requires at least one signer");
    }
    const documentId = await this.uploadDocument(input);
    try {
      for (const signer of input.signers) {
        await this.sendFreeformInvite(documentId, signer.email);
      }
    } catch (error) {
      this.logger.error(
        `signNow invite failed after upload; document ${documentId} is orphaned for acuerdo ${input.acuerdoId}`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
    await this.subscribeWebhooks(documentId);
    return { envelopeId: documentId };
  }

  async getDocument(documentId: string): Promise<SignnowDocument> {
    this.assertCredentialsConfigured();
    const response = await this.request(
      "document fetch",
      `/document/${documentId}`,
      () => ({ method: "GET", headers: {} }),
    );
    const body = (await response.json()) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error(
        "signNow document fetch response was not a document object",
      );
    }
    return body as SignnowDocument;
  }

  private assertCredentialsConfigured(): void {
    const missingEnvVars = requiredCredentialEnvVars
      .filter(({ configKey }) => this.appConfig[configKey].length === 0)
      .map(({ envVar }) => envVar);
    if (missingEnvVars.length > 0) {
      throw new Error(
        `signNow credentials are not configured; missing env vars: ${missingEnvVars.join(", ")}`,
      );
    }
  }

  private async uploadDocument(input: CreateEnvelopeInput): Promise<string> {
    const response = await this.request("document upload", "/document", () => {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([input.documentText], { type: documentTextMimeType }),
        agreementDocumentFilename(input.acuerdoId),
      );
      return { method: "POST", headers: {}, body: formData };
    });
    const body = (await response.json()) as SignnowUploadResponse;
    if (typeof body.id !== "string" || body.id.length === 0) {
      throw new Error("signNow upload response did not include a document id");
    }
    return body.id;
  }

  private async sendFreeformInvite(
    documentId: string,
    signerEmail: string,
  ): Promise<void> {
    await this.request(
      "freeform invite",
      `/document/${documentId}/invite`,
      () => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.appConfig.signnowUserEmail,
          to: signerEmail,
        }),
      }),
    );
  }

  private async subscribeWebhooks(documentId: string): Promise<void> {
    if (this.appConfig.signnowWebhookCallbackUrl.length === 0) {
      this.logger.warn(
        `SIGNNOW_WEBHOOK_CALLBACK_URL is not configured; skipping webhook subscription for document ${documentId}`,
      );
      return;
    }
    if (this.appConfig.signnowWebhookSecret.length === 0) {
      this.logger.warn(
        `SIGNNOW_WEBHOOK_SECRET is not configured; skipping webhook subscription for document ${documentId} — unsigned callbacks would always be rejected`,
      );
      return;
    }
    for (const event of webhookEvents) {
      try {
        await this.request("webhook subscription", "/api/v2/events", () => ({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            entity_id: documentId,
            action: webhookAction,
            attributes: {
              callback: this.appConfig.signnowWebhookCallbackUrl,
              secret_key: this.appConfig.signnowWebhookSecret,
            },
          }),
        }));
      } catch (error) {
        this.logger.warn(
          `signNow webhook subscription for ${event} failed on document ${documentId}; continuing without it`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  private async request(
    operation: string,
    path: string,
    buildInit: () => {
      method: string;
      headers: Record<string, string>;
      body?: BodyInit;
    },
    allowRetryOnUnauthorized = true,
  ): Promise<Response> {
    const accessToken = await this.tokenClient.getAccessToken();
    const init = buildInit();
    const response = await fetch(`${this.appConfig.signnowBasePath}${path}`, {
      method: init.method,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
      body: init.body,
      signal: AbortSignal.timeout(signnowRequestTimeoutMs),
    });
    if (response.status === unauthorizedStatus && allowRetryOnUnauthorized) {
      this.tokenClient.invalidate();
      return this.request(operation, path, buildInit, false);
    }
    if (!response.ok) {
      throw new Error(
        `signNow ${operation} failed with status ${response.status}`,
      );
    }
    return response;
  }
}
