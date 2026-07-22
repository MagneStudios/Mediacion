import { Inject, Injectable } from "@nestjs/common";
import { jwtVerify } from "jose";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import type { TokenVerifier, VerifiedClaims } from "./token-verifier";

const supabaseAccessTokenAudience = "authenticated";

@Injectable()
export class Hs256TokenVerifier implements TokenVerifier {
  private readonly secretKey: Uint8Array;

  constructor(@Inject(APP_CONFIG) appConfig: AppConfig) {
    this.secretKey = new TextEncoder().encode(appConfig.supabaseJwtSecret);
  }

  async verify(token: string): Promise<VerifiedClaims> {
    const { payload } = await jwtVerify(token, this.secretKey, {
      algorithms: ["HS256"],
      audience: supabaseAccessTokenAudience,
    });
    if (typeof payload.sub !== "string") {
      throw new Error("Token is missing a subject claim");
    }
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      exp: payload.exp,
    };
  }
}
