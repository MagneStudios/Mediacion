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
import { verifySignnowHmac } from "./hmac";
import type { SignnowCallbackPayload } from "./signnow-webhook.service";
import { SignnowWebhookService } from "./signnow-webhook.service";

const signatureHeader = "x-signnow-signature";

type SignnowWebhookRequest = RawBodyRequest<{
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
      message: "Invalid signNow webhook signature",
    },
    HttpStatus.UNAUTHORIZED,
  );
}

function invalidPayload(): HttpException {
  return new HttpException(
    {
      code: "invalid_payload",
      message: "Request body is not a JSON object",
    },
    HttpStatus.BAD_REQUEST,
  );
}

function parsePayload(rawBody: Buffer): SignnowCallbackPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw invalidPayload();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw invalidPayload();
  }
  return parsed as SignnowCallbackPayload;
}

@Controller()
export class SignnowWebhookController {
  constructor(
    @Inject(SignnowWebhookService)
    private readonly signnowWebhookService: SignnowWebhookService,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  @Public()
  @Post("webhooks/signnow")
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() request: SignnowWebhookRequest,
  ): Promise<{ received: boolean }> {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw missingRawBody();
    }
    const header = request.headers[signatureHeader];
    const headerValue = Array.isArray(header) ? header[0] : header;
    const signature = typeof headerValue === "string" ? headerValue : undefined;
    const isValid = verifySignnowHmac(
      rawBody,
      signature,
      this.appConfig.signnowWebhookSecret,
    );
    if (!isValid) {
      throw invalidSignature();
    }
    const payload = parsePayload(rawBody);
    await this.signnowWebhookService.processCallback(payload);
    return { received: true };
  }
}
