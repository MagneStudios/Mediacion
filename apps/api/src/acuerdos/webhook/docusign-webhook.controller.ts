import type { RawBodyRequest } from "@nestjs/common";
import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import { Public } from "../../auth/public.decorator";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";
import type { DocusignWebhookEvent } from "./docusign-webhook.service";
import { DocusignWebhookService } from "./docusign-webhook.service";
import { verifyDocusignHmac } from "./hmac";

const signatureHeader = "x-docusign-signature-1";

type DocusignWebhookRequest = RawBodyRequest<{
  headers: Record<string, string | string[] | undefined>;
}>;

function missingRawBody(): HttpException {
  return new HttpException(
    { code: "missing_raw_body", message: "Raw request body is required" },
    HttpStatus.BAD_REQUEST,
  );
}

function invalidSignature(): HttpException {
  return new HttpException(
    {
      code: "invalid_signature",
      message: "Invalid DocuSign Connect signature",
    },
    HttpStatus.UNAUTHORIZED,
  );
}

@Controller()
export class DocusignWebhookController {
  constructor(
    @Inject(DocusignWebhookService)
    private readonly docusignWebhookService: DocusignWebhookService,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  @Public()
  @Post("webhooks/docusign")
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() request: DocusignWebhookRequest,
  ): Promise<{ received: boolean }> {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw missingRawBody();
    }
    const header = request.headers[signatureHeader];
    const signature = typeof header === "string" ? header : undefined;
    const isValid = verifyDocusignHmac(
      rawBody,
      signature,
      this.appConfig.docusignWebhookSecret,
    );
    if (!isValid) {
      throw invalidSignature();
    }
    const event = JSON.parse(rawBody.toString("utf8")) as DocusignWebhookEvent;
    await this.docusignWebhookService.applyEvent(event);
    return { received: true };
  }
}
