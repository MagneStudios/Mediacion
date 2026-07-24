import { generateKeyPairSync } from "node:crypto";
import { importSPKI, jwtVerify } from "jose";
import type { AppConfig } from "../../config/config";
import { DocusignOauthTokenClient } from "./docusign-oauth-token-client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

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
    docusignWebhookSecret: "whsec-test",
    docusignUserId: "user-test",
    docusignOauthBase: "account-d.docusign.com",
    docusignPrivateKey: privateKey as string,
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpUser: "smtp-user",
    smtpPass: "smtp-pass",
    fcmKey: "fcm-key",
    apnsKey: "apns-key",
    ...overrides,
  };
}

describe("DocusignOauthTokenClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests a token with a JWT bearer grant signed for the configured integration key and user", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new DocusignOauthTokenClient(buildAppConfig());

    const accessToken = await client.getAccessToken();

    expect(accessToken).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://account-d.docusign.com/oauth/token",
      expect.objectContaining({ method: "POST" }),
    );
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    const assertion = body.get("assertion") as string;
    const importedPublicKey = await importSPKI(publicKey as string, "RS256");
    const { payload } = await jwtVerify(assertion, importedPublicKey, {
      algorithms: ["RS256"],
    });
    expect(payload.iss).toBe("ik-test");
    expect(payload.sub).toBe("user-test");
    expect(payload.aud).toBe("account-d.docusign.com");
    expect(payload.scope).toBe("signature impersonation");
  });

  it("reuses the cached token on a second call without requesting a new one", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new DocusignOauthTokenClient(buildAppConfig());

    await client.getAccessToken();
    const secondAccessToken = await client.getAccessToken();

    expect(secondAccessToken).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requests a fresh token once the cached token is within the expiry safety buffer", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: "token-2", expires_in: 3600 }),
      });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new DocusignOauthTokenClient(buildAppConfig());

    await client.getAccessToken();
    nowSpy.mockReturnValue(1_000_000 + 3600 * 1000 - 30_000);
    const secondAccessToken = await client.getAccessToken();

    expect(secondAccessToken).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws explicitly when the token endpoint responds with a non-ok status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new DocusignOauthTokenClient(buildAppConfig());

    await expect(client.getAccessToken()).rejects.toThrow(
      "DocuSign OAuth token request failed with status 401",
    );
  });

  it("throws explicitly when the token response has no access_token", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new DocusignOauthTokenClient(buildAppConfig());

    await expect(client.getAccessToken()).rejects.toThrow(
      "DocuSign OAuth response did not include an access_token",
    );
  });

  it("requests a new token after invalidate() is called", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new DocusignOauthTokenClient(buildAppConfig());

    await client.getAccessToken();
    client.invalidate();
    await client.getAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
