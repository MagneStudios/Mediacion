import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";
import type {
  CreateEnvelopeInput,
  CreateEnvelopeOutput,
  DocusignClient,
} from "./docusign-client";
import { DocusignOauthTokenClient } from "./docusign-oauth-token-client";

const docusignRequestTimeoutMs = 30_000;
const envelopeCreationStatus = "sent";
const unauthorizedStatus = 401;

type DocusignEnvelopeResponse = {
  envelopeId?: string;
};

@Injectable()
export class HttpDocusignClient implements DocusignClient {
  private readonly oauthTokenClient: DocusignOauthTokenClient;

  constructor(
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    oauthTokenClient?: DocusignOauthTokenClient,
  ) {
    this.oauthTokenClient =
      oauthTokenClient ?? new DocusignOauthTokenClient(appConfig);
  }

  createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeOutput> {
    return this.postEnvelope(input, true);
  }

  private async postEnvelope(
    input: CreateEnvelopeInput,
    allowRetryOnUnauthorized: boolean,
  ): Promise<CreateEnvelopeOutput> {
    const envelopesUrl = `${this.appConfig.docusignBasePath}/v2.1/accounts/${this.appConfig.docusignAccountId}/envelopes`;
    const accessToken = await this.oauthTokenClient.getAccessToken();
    const response = await fetch(envelopesUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: envelopeCreationStatus,
        recipients: {
          signers: input.signers.map((signer, index) => ({
            email: signer.email,
            name: signer.name,
            recipientId: String(index + 1),
            clientUserId: signer.usuarioId,
          })),
        },
      }),
      signal: AbortSignal.timeout(docusignRequestTimeoutMs),
    });
    if (response.status === unauthorizedStatus && allowRetryOnUnauthorized) {
      this.oauthTokenClient.invalidate();
      return this.postEnvelope(input, false);
    }
    if (!response.ok) {
      throw new Error(
        `DocuSign envelope creation failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as DocusignEnvelopeResponse;
    if (typeof body.envelopeId !== "string" || body.envelopeId.length === 0) {
      throw new Error("DocuSign response did not include an envelopeId");
    }
    return { envelopeId: body.envelopeId };
  }
}
