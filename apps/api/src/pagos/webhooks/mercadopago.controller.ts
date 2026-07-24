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
import { PagosService } from "../pagos.service";
import { verifyMercadoPagoSignature } from "./signature";

const signatureHeader = "x-signature";
const requestIdHeader = "x-request-id";
const dataIdQueryParam = "data.id";

type MercadoPagoWebhookBody = {
  data?: { id?: string };
};

type MercadoPagoWebhookRequest = RawBodyRequest<{
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
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
      message: "Invalid Mercado Pago signature",
    },
    HttpStatus.UNAUTHORIZED,
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseJsonBody(rawBody: Buffer): MercadoPagoWebhookBody {
  try {
    return JSON.parse(rawBody.toString("utf8")) as MercadoPagoWebhookBody;
  } catch {
    return {};
  }
}

function extractDataId(
  query: Record<string, string | string[] | undefined>,
  body: MercadoPagoWebhookBody,
): string | undefined {
  return firstValue(query[dataIdQueryParam]) ?? body.data?.id;
}

@Controller()
export class MercadoPagoWebhookController {
  constructor(
    @Inject(PagosService) private readonly pagosService: PagosService,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  @Public()
  @Post("webhooks/mercadopago")
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() request: MercadoPagoWebhookRequest,
  ): Promise<{ received: boolean }> {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw missingRawBody();
    }
    const body = parseJsonBody(rawBody);
    const dataId = extractDataId(request.query, body);
    const isValid = verifyMercadoPagoSignature({
      xSignature: firstValue(request.headers[signatureHeader]),
      xRequestId: firstValue(request.headers[requestIdHeader]),
      dataId,
      secret: this.appConfig.mpWebhookSecret,
    });
    if (!isValid || !dataId) {
      throw invalidSignature();
    }
    await this.pagosService.processWebhookPayment(dataId);
    return { received: true };
  }
}
