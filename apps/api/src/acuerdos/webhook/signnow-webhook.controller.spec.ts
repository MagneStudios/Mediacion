import { createHmac } from "node:crypto";
import { HttpException } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { SignnowWebhookController } from "./signnow-webhook.controller";
import type { SignnowWebhookService } from "./signnow-webhook.service";

const secret = "whsec-signnow-test";

function buildConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    signnowWebhookSecret: secret,
    ...overrides,
  } as never;
}

function buildController(
  processCallback: jest.Mock,
  config: AppConfig = buildConfig(),
): SignnowWebhookController {
  return new SignnowWebhookController(
    { processCallback } as unknown as SignnowWebhookService,
    config,
  );
}

const payload = {
  meta: { event: "document.complete" },
  content: { document_id: "document-1" },
};
const rawBody = Buffer.from(JSON.stringify(payload));

describe("SignnowWebhookController", () => {
  it("accepts a hex HMAC signature over the raw body and forwards the parsed payload", async () => {
    const processCallback = jest.fn().mockResolvedValue(undefined);
    const controller = buildController(processCallback);
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const result = await controller.receive({
      rawBody,
      headers: { "x-signnow-signature": signature },
    } as never);

    expect(processCallback).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ received: true });
  });

  it("accepts a base64 HMAC signature over the raw body", async () => {
    const processCallback = jest.fn().mockResolvedValue(undefined);
    const controller = buildController(processCallback);
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const result = await controller.receive({
      rawBody,
      headers: { "x-signnow-signature": signature },
    } as never);

    expect(processCallback).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ received: true });
  });

  it("accepts the signature header as an array by taking its first element", async () => {
    const processCallback = jest.fn().mockResolvedValue(undefined);
    const controller = buildController(processCallback);
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const result = await controller.receive({
      rawBody,
      headers: { "x-signnow-signature": [signature, "second-value"] },
    } as never);

    expect(processCallback).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ received: true });
  });

  it("rejects with 400 invalid_payload when the signed body is not valid JSON", async () => {
    const processCallback = jest.fn();
    const controller = buildController(processCallback);
    const invalidJsonBody = Buffer.from("{not-json");
    const signature = createHmac("sha256", secret)
      .update(invalidJsonBody)
      .digest("hex");

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody: invalidJsonBody,
        headers: { "x-signnow-signature": signature },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(400);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({ code: "invalid_payload" }),
    );
    expect(processCallback).not.toHaveBeenCalled();
  });

  it("rejects with 400 invalid_payload when the signed body parses to null or a non-object", async () => {
    const processCallback = jest.fn();
    const controller = buildController(processCallback);

    for (const bodyText of ["null", '"a string"', "[1,2]"]) {
      const body = Buffer.from(bodyText);
      const signature = createHmac("sha256", secret).update(body).digest("hex");

      let thrown: unknown;
      try {
        await controller.receive({
          rawBody: body,
          headers: { "x-signnow-signature": signature },
        } as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect((thrown as HttpException).getResponse()).toEqual(
        expect.objectContaining({ code: "invalid_payload" }),
      );
    }
    expect(processCallback).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature is invalid, without invoking the service", async () => {
    const processCallback = jest.fn();
    const controller = buildController(processCallback);

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody,
        headers: { "x-signnow-signature": "invalid-signature" },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(processCallback).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature header is missing, without invoking the service", async () => {
    const processCallback = jest.fn();
    const controller = buildController(processCallback);

    let thrown: unknown;
    try {
      await controller.receive({ rawBody, headers: {} } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(processCallback).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the webhook secret is unconfigured, even if the signature matches an empty secret", async () => {
    const processCallback = jest.fn();
    const controller = buildController(
      processCallback,
      buildConfig({ signnowWebhookSecret: "" }),
    );
    const signature = createHmac("sha256", "").update(rawBody).digest("hex");

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody,
        headers: { "x-signnow-signature": signature },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(processCallback).not.toHaveBeenCalled();
  });

  it("rejects with 400 when the raw body is absent, never falling back to a parsed body", async () => {
    const processCallback = jest.fn();
    const controller = buildController(processCallback);

    let thrown: unknown;
    try {
      await controller.receive({
        rawBody: undefined,
        headers: { "x-signnow-signature": "anything" },
      } as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(400);
    expect(processCallback).not.toHaveBeenCalled();
  });
});
