import { Logger } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { HttpSignnowClient } from "./http-signnow-client";
import type { SignnowTokenClient } from "./signnow-token-client";

const basePath = "https://api-eval.signnow.com";

function buildConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    signnowBasePath: basePath,
    signnowClientId: "client-id-1",
    signnowClientSecret: "client-secret-1",
    signnowUserEmail: "owner@example.com",
    signnowUserPassword: "owner-password",
    signnowWebhookSecret: "whsec-signnow",
    signnowWebhookCallbackUrl: "https://api.test/api/webhooks/signnow",
    ...overrides,
  } as never;
}

function buildTokenClient(overrides?: {
  getAccessToken?: jest.Mock;
  invalidate?: jest.Mock;
}): SignnowTokenClient {
  return {
    getAccessToken:
      overrides?.getAccessToken ??
      jest.fn().mockResolvedValue("access-token-1"),
    invalidate: overrides?.invalidate ?? jest.fn(),
  } as unknown as SignnowTokenClient;
}

function okJson(body: unknown): {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
} {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

const envelopeInput = {
  acuerdoId: "acuerdo-1",
  documentText: "ACUERDO DE MEDIACIÓN\n\nIdentificador: acuerdo-1\n",
  signers: [
    { usuarioId: "user-a", email: "a@example.com", name: "Parte A" },
    { usuarioId: "user-b", email: "b@example.com", name: "Parte B" },
  ],
};

describe("HttpSignnowClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uploads the document, invites every signer freeform and subscribes both webhook events", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ id: "document-1" }))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    const result = await client.createEnvelope(envelopeInput);

    expect(result).toEqual({ envelopeId: "document-1" });
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[0];
    expect(uploadUrl).toBe(`${basePath}/document`);
    expect(uploadInit.method).toBe("POST");
    expect(uploadInit.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer access-token-1" }),
    );
    const formData = uploadInit.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    const file = formData.get("file") as File;
    expect(file.name).toBe("acuerdo-acuerdo-1.txt");
    expect(await file.text()).toBe(envelopeInput.documentText);

    const [inviteUrlA, inviteInitA] = fetchMock.mock.calls[1];
    expect(inviteUrlA).toBe(`${basePath}/document/document-1/invite`);
    expect(JSON.parse(inviteInitA.body as string)).toEqual({
      from: "owner@example.com",
      to: "a@example.com",
    });
    const [inviteUrlB, inviteInitB] = fetchMock.mock.calls[2];
    expect(inviteUrlB).toBe(`${basePath}/document/document-1/invite`);
    expect(JSON.parse(inviteInitB.body as string)).toEqual({
      from: "owner@example.com",
      to: "b@example.com",
    });

    const subscriptionBodies = [3, 4].map((index) =>
      JSON.parse(fetchMock.mock.calls[index][1].body as string),
    );
    expect(fetchMock.mock.calls[3][0]).toBe(`${basePath}/api/v2/events`);
    expect(fetchMock.mock.calls[4][0]).toBe(`${basePath}/api/v2/events`);
    expect(subscriptionBodies).toEqual([
      {
        event: "document.complete",
        entity_id: "document-1",
        action: "callback",
        attributes: {
          callback: "https://api.test/api/webhooks/signnow",
          secret_key: "whsec-signnow",
        },
      },
      {
        event: "document.update",
        entity_id: "document-1",
        action: "callback",
        attributes: {
          callback: "https://api.test/api/webhooks/signnow",
          secret_key: "whsec-signnow",
        },
      },
    ]);
  });

  it("throws a clear error listing the missing env vars when credentials are unconfigured, without calling signNow", async () => {
    const fetchMock = jest.fn();
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(
      buildConfig({
        signnowClientId: "",
        signnowUserPassword: "",
      }),
      buildTokenClient(),
    );

    await expect(client.createEnvelope(envelopeInput)).rejects.toThrow(
      "signNow credentials are not configured; missing env vars: SIGNNOW_CLIENT_ID, SIGNNOW_USER_PASSWORD",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an envelope without signers before uploading anything", async () => {
    const fetchMock = jest.fn();
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await expect(
      client.createEnvelope({ ...envelopeInput, signers: [] }),
    ).rejects.toThrow("signNow envelope requires at least one signer");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs the orphaned document id and acuerdo id when an invite fails after the upload", async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ id: "document-1" }))
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({}),
      });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await expect(client.createEnvelope(envelopeInput)).rejects.toThrow(
      "signNow freeform invite failed with status 400",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("document document-1 is orphaned"),
      expect.anything(),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("acuerdo acuerdo-1"),
      expect.anything(),
    );
  });

  it("invalidates the token and retries once when signNow responds 401", async () => {
    const getAccessToken = jest
      .fn()
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("fresh-token");
    const invalidate = jest.fn();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValue(okJson({ id: "document-1" }));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(
      buildConfig({ signnowWebhookCallbackUrl: "" }),
      buildTokenClient({ getAccessToken, invalidate }),
    );

    const result = await client.createEnvelope({
      ...envelopeInput,
      signers: [envelopeInput.signers[0]],
    });

    expect(result).toEqual({ envelopeId: "document-1" });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    );
  });

  it("fails after a single retry when signNow still responds 401", async () => {
    const invalidate = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(
      buildConfig(),
      buildTokenClient({ invalidate }),
    );

    await expect(client.createEnvelope(envelopeInput)).rejects.toThrow(
      "signNow document upload failed with status 401",
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws explicitly when the document upload responds with a non-ok status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await expect(client.createEnvelope(envelopeInput)).rejects.toThrow(
      "signNow document upload failed with status 502",
    );
  });

  it("throws explicitly when a freeform invite responds with a non-ok status", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ id: "document-1" }))
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({}),
      });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await expect(client.createEnvelope(envelopeInput)).rejects.toThrow(
      "signNow freeform invite failed with status 400",
    );
  });

  it("throws explicitly when the upload response has no document id", async () => {
    const fetchMock = jest.fn().mockResolvedValue(okJson({}));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await expect(client.createEnvelope(envelopeInput)).rejects.toThrow(
      "signNow upload response did not include a document id",
    );
  });

  it("does not fail the envelope creation when the webhook subscription fails", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ id: "document-1" }))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    const result = await client.createEnvelope(envelopeInput);

    expect(result).toEqual({ envelopeId: "document-1" });
  });

  it("skips the webhook subscription with only upload and invites when the callback URL is unconfigured", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ id: "document-1" }))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(
      buildConfig({ signnowWebhookCallbackUrl: "" }),
      buildTokenClient(),
    );

    const result = await client.createEnvelope(envelopeInput);

    expect(result).toEqual({ envelopeId: "document-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calledUrls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calledUrls).not.toContain(`${basePath}/api/v2/events`);
  });

  it("skips the webhook subscription with a warning when the webhook secret is unconfigured", async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ id: "document-1" }))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(
      buildConfig({ signnowWebhookSecret: "" }),
      buildTokenClient(),
    );

    const result = await client.createEnvelope(envelopeInput);

    expect(result).toEqual({ envelopeId: "document-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calledUrls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calledUrls).not.toContain(`${basePath}/api/v2/events`);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SIGNNOW_WEBHOOK_SECRET is not configured"),
    );
  });

  it("still attempts the second webhook subscription when the first one fails", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ id: "document-1" }))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce(okJson({}));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    const result = await client.createEnvelope(envelopeInput);

    expect(result).toEqual({ envelopeId: "document-1" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const eventCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === `${basePath}/api/v2/events`,
    );
    expect(eventCalls).toHaveLength(2);
    const subscribedEvents = eventCalls.map(
      (call) => JSON.parse(call[1].body as string).event as string,
    );
    expect(subscribedEvents).toEqual(["document.complete", "document.update"]);
  });

  it("bounds every request with a 30 second application-level abort timeout", async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
    const fetchMock = jest.fn().mockResolvedValue(okJson({ id: "document-1" }));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await client.createEnvelope(envelopeInput);

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects cleanly when fetch fails with a network error", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await expect(client.createEnvelope(envelopeInput)).rejects.toThrow(
      "fetch failed",
    );
  });

  it("fetches a document with a Bearer token via getDocument", async () => {
    const document = {
      requests: [{ signer_email: "a@example.com", signature_id: "sig-1" }],
      field_invites: [],
    };
    const fetchMock = jest.fn().mockResolvedValue(okJson(document));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    const result = await client.getDocument("document-1");

    expect(result).toEqual(document);
    expect(fetchMock).toHaveBeenCalledWith(
      `${basePath}/document/document-1`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-1",
        }),
      }),
    );
  });

  it("throws explicitly when the document fetch responds with a non-ok status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());

    await expect(client.getDocument("document-1")).rejects.toThrow(
      "signNow document fetch failed with status 404",
    );
  });

  it("throws a clear error from getDocument when credentials are unconfigured, without calling signNow", async () => {
    const fetchMock = jest.fn();
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpSignnowClient(
      buildConfig({ signnowClientId: "", signnowUserPassword: "" }),
      buildTokenClient(),
    );

    await expect(client.getDocument("document-1")).rejects.toThrow(
      "signNow credentials are not configured; missing env vars: SIGNNOW_CLIENT_ID, SIGNNOW_USER_PASSWORD",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws explicitly when the document fetch body is not an object", async () => {
    const client = new HttpSignnowClient(buildConfig(), buildTokenClient());
    for (const body of [null, "not-an-object", [1, 2]]) {
      const fetchMock = jest.fn().mockResolvedValue(okJson(body));
      jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);

      await expect(client.getDocument("document-1")).rejects.toThrow(
        "signNow document fetch response was not a document object",
      );
    }
  });
});
