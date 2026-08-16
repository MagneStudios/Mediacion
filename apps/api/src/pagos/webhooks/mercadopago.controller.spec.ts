import { createHmac } from "node:crypto";
import { HttpException } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import type { PagosService } from "../pagos.service";
import { MercadoPagoWebhookController } from "./mercadopago.controller";

const secret = "mp-webhook-secret";

function buildAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 3000,
    supabaseJwtSecret: "secret",
    databaseUrl: "postgresql://placeholder",
    openrouterApiKey: "sk-or-test-key",
    docusignIntegrationKey: "ik-test",
    docusignClientSecret: "secret-test",
    docusignAccountId: "account-test",
    docusignBasePath: "https://demo.docusign.net/restapi",
    docusignWebhookSecret: "docusign-secret",
    docusignUserId: "user-test",
    docusignOauthBase: "account-d.docusign.com",
    docusignPrivateKey: "test-private-key-pem",
    mpAccessToken: "mp-access-token",
    mpWebhookSecret: secret,
    cronSecret: "cron-secret",
    corsOrigins: [],
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpUser: "smtp-user",
    smtpPass: "smtp-pass",
    fcmKey: "fcm-key",
    apnsKey: "apns-key",
    operacionesEmail: "operaciones@test",
    legalAvisoDiasAnticipacion: 10,
    legalPublicRequestsPerWindow: 5,
    legalPublicWindowMs: 3_600_000,
    ...overrides,
  };
}

function signManifest(
  dataId: string,
  requestId: string,
  ts: string,
  hmacSecret: string,
): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", hmacSecret).update(manifest).digest("hex");
}

describe("MercadoPagoWebhookController", () => {
  it("verifies the x-signature and forwards data.id (from query) to the service", async () => {
    const processWebhookPayment = jest.fn().mockResolvedValue(undefined);
    const controller = new MercadoPagoWebhookController(
      { processWebhookPayment } as unknown as PagosService,
      buildAppConfig(),
    );
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-1";
    const v1 = signManifest("123456", requestId, ts, secret);
    const rawBody = Buffer.from(
      JSON.stringify({ action: "payment.updated", data: { id: "123456" } }),
    );

    const result = await controller.receive({
      rawBody,
      headers: {
        "x-signature": `ts=${ts},v1=${v1}`,
        "x-request-id": requestId,
      },
      query: { "data.id": "123456" },
    } as never);

    expect(processWebhookPayment).toHaveBeenCalledWith("123456");
    expect(result).toEqual({ received: true });
  });

  it("falls back to data.id parsed from the body when the query param is absent", async () => {
    const processWebhookPayment = jest.fn().mockResolvedValue(undefined);
    const controller = new MercadoPagoWebhookController(
      { processWebhookPayment } as unknown as PagosService,
      buildAppConfig(),
    );
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-1";
    const v1 = signManifest("123456", requestId, ts, secret);
    const rawBody = Buffer.from(
      JSON.stringify({ action: "payment.updated", data: { id: "123456" } }),
    );

    const result = await controller.receive({
      rawBody,
      headers: {
        "x-signature": `ts=${ts},v1=${v1}`,
        "x-request-id": requestId,
      },
      query: {},
    } as never);

    expect(processWebhookPayment).toHaveBeenCalledWith("123456");
    expect(result).toEqual({ received: true });
  });

  it("rejects with 401 when the signature is missing, without invoking the service", async () => {
    const processWebhookPayment = jest.fn();
    const controller = new MercadoPagoWebhookController(
      { processWebhookPayment } as unknown as PagosService,
      buildAppConfig(),
    );
    const rawBody = Buffer.from(JSON.stringify({ data: { id: "123456" } }));

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody,
        headers: {},
        query: { "data.id": "123456" },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(processWebhookPayment).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature is forged, without invoking the service", async () => {
    const processWebhookPayment = jest.fn();
    const controller = new MercadoPagoWebhookController(
      { processWebhookPayment } as unknown as PagosService,
      buildAppConfig(),
    );
    const rawBody = Buffer.from(JSON.stringify({ data: { id: "123456" } }));

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody,
        headers: {
          "x-signature": "ts=1704908010,v1=deadbeef",
          "x-request-id": "req-1",
        },
        query: { "data.id": "123456" },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(processWebhookPayment).not.toHaveBeenCalled();
  });

  it("rejects with 400 when the raw body is absent, never falling back to a parsed body", async () => {
    const processWebhookPayment = jest.fn();
    const controller = new MercadoPagoWebhookController(
      { processWebhookPayment } as unknown as PagosService,
      buildAppConfig(),
    );

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody: undefined,
        headers: { "x-signature": "ts=1,v1=aa", "x-request-id": "req-1" },
        query: { "data.id": "123456" },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(400);
    expect(processWebhookPayment).not.toHaveBeenCalled();
  });

  it("rejects with 401 when data.id cannot be determined at all", async () => {
    const processWebhookPayment = jest.fn();
    const controller = new MercadoPagoWebhookController(
      { processWebhookPayment } as unknown as PagosService,
      buildAppConfig(),
    );
    const rawBody = Buffer.from(JSON.stringify({ action: "payment.updated" }));

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody,
        headers: {
          "x-signature": "ts=1704908010,v1=deadbeef",
          "x-request-id": "req-1",
        },
        query: {},
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(processWebhookPayment).not.toHaveBeenCalled();
  });
});
