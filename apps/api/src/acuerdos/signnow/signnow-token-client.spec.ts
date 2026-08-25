import type { AppConfig } from "../../config/config";
import { SignnowTokenClient } from "./signnow-token-client";

function buildConfig(): AppConfig {
  return {
    signnowBasePath: "https://api-eval.signnow.com",
    signnowClientId: "client-id-1",
    signnowClientSecret: "client-secret-1",
    signnowUserEmail: "owner@example.com",
    signnowUserPassword: "owner-password",
  } as never;
}

const tokenUrl = "https://api-eval.signnow.com/oauth2/token";

describe("SignnowTokenClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests a token with the password grant and Basic client credentials", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    const accessToken = await client.getAccessToken();

    expect(accessToken).toBe("token-1");
    const expectedBasic = Buffer.from("client-id-1:client-secret-1").toString(
      "base64",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      tokenUrl,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedBasic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("username")).toBe("owner@example.com");
    expect(body.get("password")).toBe("owner-password");
    expect(body.get("grant_type")).toBe("password");
    expect(body.get("scope")).toBe("*");
  });

  it("reuses the cached token on a second call without requesting a new one", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    await client.getAccessToken();
    const secondAccessToken = await client.getAccessToken();

    expect(secondAccessToken).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requests a fresh token once the cached token is within the 60s expiry safety buffer", async () => {
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
    const client = new SignnowTokenClient(buildConfig());

    await client.getAccessToken();
    nowSpy.mockReturnValue(1_000_000 + 3600 * 1000 - 30_000);
    const secondAccessToken = await client.getAccessToken();

    expect(secondAccessToken).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requests a new token after invalidate() is called", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    await client.getAccessToken();
    client.invalidate();
    await client.getAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent token requests into a single fetch", async () => {
    let resolveResponse: (value: unknown) => void = () => undefined;
    const fetchMock = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    const firstRequest = client.getAccessToken();
    const secondRequest = client.getAccessToken();
    resolveResponse({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });

    await expect(firstRequest).resolves.toBe("token-1");
    await expect(secondRequest).resolves.toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a failed in-flight request for a later call", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: "token-2", expires_in: 3600 }),
      });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    await expect(client.getAccessToken()).rejects.toThrow(
      "signNow OAuth token request failed with status 500",
    );
    await expect(client.getAccessToken()).resolves.toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bounds the token request with a 30 second application-level abort timeout", async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    await client.getAccessToken();

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledWith(
      tokenUrl,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("throws explicitly when the token endpoint responds with a non-ok status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    await expect(client.getAccessToken()).rejects.toThrow(
      "signNow OAuth token request failed with status 401",
    );
  });

  it("throws explicitly when the token response has no access_token", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const client = new SignnowTokenClient(buildConfig());

    await expect(client.getAccessToken()).rejects.toThrow(
      "signNow OAuth response did not include an access_token",
    );
  });
});
