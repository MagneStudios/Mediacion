import type { DocusignOauthTokenClient } from "./docusign-oauth-token-client";
import { HttpDocusignClient } from "./http-docusign-client";

function buildOauthTokenClient(overrides?: {
  getAccessToken?: jest.Mock;
  invalidate?: jest.Mock;
}): DocusignOauthTokenClient {
  return {
    getAccessToken:
      overrides?.getAccessToken ??
      jest.fn().mockResolvedValue("access-token-1"),
    invalidate: overrides?.invalidate ?? jest.fn(),
  } as unknown as DocusignOauthTokenClient;
}

const envelopesUrl =
  "https://demo.docusign.net/restapi/v2.1/accounts/account-test/envelopes";

describe("HttpDocusignClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("posts an envelope creation request with a Bearer token obtained from the OAuth token client", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ envelopeId: "envelope-1" }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const oauthTokenClient = buildOauthTokenClient();
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      oauthTokenClient,
    );

    const result = await client.createEnvelope({
      acuerdoId: "acuerdo-1",
      signers: [
        { usuarioId: "user-a", email: "a@example.com", name: "Parte A" },
        { usuarioId: "user-b", email: "b@example.com", name: "Parte B" },
      ],
    });

    expect(result).toEqual({ envelopeId: "envelope-1" });
    expect(oauthTokenClient.getAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      envelopesUrl,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-1",
          "Content-Type": "application/json",
        }),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody).toEqual(
      expect.objectContaining({
        status: "sent",
        recipients: {
          signers: [
            expect.objectContaining({
              email: "a@example.com",
              name: "Parte A",
              recipientId: "1",
            }),
            expect.objectContaining({
              email: "b@example.com",
              name: "Parte B",
              recipientId: "2",
            }),
          ],
        },
      }),
    );
  });

  it("throws explicitly when DocuSign responds with a non-ok status other than 401", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient(),
    );

    await expect(
      client.createEnvelope({
        acuerdoId: "acuerdo-1",
        signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
      }),
    ).rejects.toThrow("DocuSign envelope creation failed with status 502");
  });

  it("throws explicitly when the response has no envelopeId", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient(),
    );

    await expect(
      client.createEnvelope({
        acuerdoId: "acuerdo-1",
        signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
      }),
    ).rejects.toThrow("DocuSign response did not include an envelopeId");
  });

  it("bounds the request with a 30 second application-level abort timeout", async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ envelopeId: "envelope-1" }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient(),
    );

    await client.createEnvelope({
      acuerdoId: "acuerdo-1",
      signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
    });

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects cleanly when the request is aborted by the timeout", async () => {
    const abortError = new DOMException(
      "This operation was aborted",
      "AbortError",
    );
    const fetchMock = jest.fn().mockRejectedValue(abortError);
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient(),
    );

    await expect(
      client.createEnvelope({
        acuerdoId: "acuerdo-1",
        signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
      }),
    ).rejects.toThrow("aborted");
  });

  it("rejects cleanly when fetch fails with a network error", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient(),
    );

    await expect(
      client.createEnvelope({
        acuerdoId: "acuerdo-1",
        signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
      }),
    ).rejects.toThrow("fetch failed");
  });

  it("rejects cleanly when the response body is malformed and json() throws", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient(),
    );

    await expect(
      client.createEnvelope({
        acuerdoId: "acuerdo-1",
        signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
      }),
    ).rejects.toThrow("Unexpected token");
  });

  it("invalidates the cached token and retries once when the envelope endpoint responds 401", async () => {
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
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ envelopeId: "envelope-1" }),
      });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient({ getAccessToken, invalidate }),
    );

    const result = await client.createEnvelope({
      acuerdoId: "acuerdo-1",
      signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
    });

    expect(result).toEqual({ envelopeId: "envelope-1" });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    );
  });

  it("fails after a single retry when the envelope endpoint still responds 401", async () => {
    const getAccessToken = jest
      .fn()
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("still-expired-token");
    const invalidate = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new HttpDocusignClient(
      {
        docusignBasePath: "https://demo.docusign.net/restapi",
        docusignAccountId: "account-test",
      } as never,
      buildOauthTokenClient({ getAccessToken, invalidate }),
    );

    await expect(
      client.createEnvelope({
        acuerdoId: "acuerdo-1",
        signers: [{ usuarioId: "user-a", email: "a@example.com", name: "A" }],
      }),
    ).rejects.toThrow("DocuSign envelope creation failed with status 401");
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
