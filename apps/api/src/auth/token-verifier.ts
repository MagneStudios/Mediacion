export type VerifiedClaims = {
  sub: string;
  email?: string;
  exp?: number;
};

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedClaims>;
}

export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");
