import { SignJWT, UnsecuredJWT } from "jose";
import type { AppConfig } from "../config/config";
import { Hs256TokenVerifier } from "./hs256-token-verifier";

const secret = "test-secret-for-hs256-token-verifier-unit-tests";
const secretKey = new TextEncoder().encode(secret);

function signToken(
  payload: Record<string, unknown>,
  expiresInSeconds: number,
): Promise<string> {
  return new SignJWT({ aud: "authenticated", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(secretKey);
}

describe("Hs256TokenVerifier", () => {
  const appConfig = { supabaseJwtSecret: secret } as AppConfig;
  const verifier = new Hs256TokenVerifier(appConfig);

  it("resolves claims for a validly signed token", async () => {
    const token = await signToken({ sub: "user-1", email: "a@b.com" }, 60);

    const claims = await verifier.verify(token);

    expect(claims.sub).toBe("user-1");
    expect(claims.email).toBe("a@b.com");
  });

  it("rejects an expired token", async () => {
    const token = await signToken({ sub: "user-1" }, -60);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const otherKey = new TextEncoder().encode("a-completely-different-secret");
    const token = await new SignJWT({ sub: "user-1", aud: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(otherKey);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it("rejects a malformed token string", async () => {
    await expect(verifier.verify("not-a-jwt")).rejects.toThrow();
  });

  it("rejects a correctly signed token with the wrong audience", async () => {
    const token = await new SignJWT({ sub: "user-1", aud: "other-audience" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(secretKey);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it("rejects an unsigned none-alg token", async () => {
    const token = new UnsecuredJWT({
      sub: "user-1",
      aud: "authenticated",
    }).encode();

    await expect(verifier.verify(token)).rejects.toThrow();
  });
});
