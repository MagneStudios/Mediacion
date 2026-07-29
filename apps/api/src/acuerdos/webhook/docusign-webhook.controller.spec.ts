import { createHmac } from "node:crypto";
import { HttpException } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { DocusignWebhookController } from "./docusign-webhook.controller";
import type { DocusignWebhookService } from "./docusign-webhook.service";

const secret = "whsec-test";

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
    docusignWebhookSecret: secret,
    docusignUserId: "user-test",
    docusignOauthBase: "account-d.docusign.com",
    docusignPrivateKey: "test-private-key-pem",
    mpAccessToken: "mp-access-token",
    mpWebhookSecret: "mp-webhook-secret",
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpUser: "smtp-user",
    smtpPass: "smtp-pass",
    fcmKey: "fcm-key",
    apnsKey: "apns-key",
    cronSecret: "cron-secret",
    corsOrigins: [],
    ...overrides,
  };
}

function signRawBody(rawBody: Buffer): string {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

describe("DocusignWebhookController", () => {
  it("verifies the HMAC over the raw body and forwards the parsed event to the service", async () => {
    const applyEvent = jest.fn().mockResolvedValue(undefined);
    const controller = new DocusignWebhookController(
      { applyEvent } as unknown as DocusignWebhookService,
      buildAppConfig(),
    );
    const payload = {
      envelopeId: "envelope-1",
      recipientEmail: "a@example.com",
      status: "signed",
      event: "recipient-completed",
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = signRawBody(rawBody);

    const result = await controller.receive({
      rawBody,
      headers: { "x-docusign-signature-1": signature },
    } as never);

    expect(applyEvent).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ received: true });
  });

  it("rejects with 401 when the signature is invalid, without invoking the service", async () => {
    const applyEvent = jest.fn();
    const controller = new DocusignWebhookController(
      { applyEvent } as unknown as DocusignWebhookService,
      buildAppConfig(),
    );
    const rawBody = Buffer.from(JSON.stringify({ envelopeId: "envelope-1" }));

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody,
        headers: { "x-docusign-signature-1": "invalid-signature" },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(applyEvent).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature header is missing, without invoking the service", async () => {
    const applyEvent = jest.fn();
    const controller = new DocusignWebhookController(
      { applyEvent } as unknown as DocusignWebhookService,
      buildAppConfig(),
    );
    const rawBody = Buffer.from(JSON.stringify({ envelopeId: "envelope-1" }));

    let thrown: unknown;
    try {
      await controller.receive({ rawBody, headers: {} } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(applyEvent).not.toHaveBeenCalled();
  });

  it("rejects with 400 when the raw body is absent, never falling back to a parsed body", async () => {
    const applyEvent = jest.fn();
    const controller = new DocusignWebhookController(
      { applyEvent } as unknown as DocusignWebhookService,
      buildAppConfig(),
    );

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody: undefined,
        headers: { "x-docusign-signature-1": "anything" },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(400);
    expect(applyEvent).not.toHaveBeenCalled();
  });
});
