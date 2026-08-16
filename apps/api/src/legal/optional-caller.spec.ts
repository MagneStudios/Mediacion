import type { TokenVerifier } from "../auth/token-verifier";
import { readBearerToken, resolveOptionalCallerId } from "./optional-caller";

describe("readBearerToken", () => {
  it("reads the token out of a Bearer header", () => {
    expect(readBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("ignores anything that is not a Bearer header", () => {
    expect(readBearerToken(undefined)).toBeUndefined();
    expect(readBearerToken("Basic abc")).toBeUndefined();
    expect(readBearerToken("Bearer   ")).toBeUndefined();
  });
});

describe("resolveOptionalCallerId", () => {
  function buildVerifier(verify: jest.Mock): TokenVerifier {
    return { verify } as unknown as TokenVerifier;
  }

  it("returns the sub of a valid token", async () => {
    const verify = jest.fn().mockResolvedValue({ sub: "user-1" });

    await expect(
      resolveOptionalCallerId(buildVerifier(verify), "Bearer token"),
    ).resolves.toBe("user-1");
  });

  it("returns null without a token, because the route is public", async () => {
    const verify = jest.fn();

    await expect(
      resolveOptionalCallerId(buildVerifier(verify), undefined),
    ).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("swallows an invalid token instead of failing the public request", async () => {
    const verify = jest.fn().mockRejectedValue(new Error("expired"));

    await expect(
      resolveOptionalCallerId(buildVerifier(verify), "Bearer token"),
    ).resolves.toBeNull();
  });
});
