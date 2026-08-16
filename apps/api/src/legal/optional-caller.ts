import type { TokenVerifier } from "../auth/token-verifier";

const bearerPrefix = "Bearer ";

export function readBearerToken(
  authorization: string | undefined,
): string | undefined {
  if (!authorization?.startsWith(bearerPrefix)) {
    return undefined;
  }
  const token = authorization.slice(bearerPrefix.length).trim();
  return token.length > 0 ? token : undefined;
}

export async function resolveOptionalCallerId(
  tokenVerifier: TokenVerifier,
  authorization: string | undefined,
): Promise<string | null> {
  const token = readBearerToken(authorization);
  if (!token) {
    return null;
  }
  try {
    const claims = await tokenVerifier.verify(token);
    return claims.sub ?? null;
  } catch {
    return null;
  }
}
