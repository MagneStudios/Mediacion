import { Inject, Injectable } from "@nestjs/common";
import { importPKCS8, SignJWT } from "jose";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";

const jwtGrantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const jwtAssertionAlgorithm = "RS256";
const jwtScope = "signature impersonation";
const jwtExpiration = "1h";
const defaultExpiresInSeconds = 3600;
const expirySafetyBufferMs = 60_000;

type DocusignTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

@Injectable()
export class DocusignOauthTokenClient {
  private cachedToken: CachedToken | undefined;

  constructor(@Inject(APP_CONFIG) private readonly appConfig: AppConfig) {}

  async getAccessToken(): Promise<string> {
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt > Date.now() + expirySafetyBufferMs
    ) {
      return this.cachedToken.accessToken;
    }
    return this.fetchAndCacheToken();
  }

  invalidate(): void {
    this.cachedToken = undefined;
  }

  private async fetchAndCacheToken(): Promise<string> {
    const assertion = await this.buildJwtAssertion();
    const tokenUrl = `https://${this.appConfig.docusignOauthBase}/oauth/token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: jwtGrantType,
        assertion,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `DocuSign OAuth token request failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as DocusignTokenResponse;
    if (
      typeof body.access_token !== "string" ||
      body.access_token.length === 0
    ) {
      throw new Error(
        "DocuSign OAuth response did not include an access_token",
      );
    }
    const expiresInSeconds =
      typeof body.expires_in === "number"
        ? body.expires_in
        : defaultExpiresInSeconds;
    this.cachedToken = {
      accessToken: body.access_token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };
    return this.cachedToken.accessToken;
  }

  private async buildJwtAssertion(): Promise<string> {
    const privateKey = await importPKCS8(
      this.appConfig.docusignPrivateKey,
      jwtAssertionAlgorithm,
    );
    return new SignJWT({ scope: jwtScope })
      .setProtectedHeader({ alg: jwtAssertionAlgorithm })
      .setIssuer(this.appConfig.docusignIntegrationKey)
      .setSubject(this.appConfig.docusignUserId)
      .setAudience(this.appConfig.docusignOauthBase)
      .setIssuedAt()
      .setExpirationTime(jwtExpiration)
      .sign(privateKey);
  }
}
