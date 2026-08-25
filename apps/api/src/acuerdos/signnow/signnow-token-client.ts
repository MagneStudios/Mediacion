import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";

const passwordGrantType = "password";
const tokenScope = "*";
const defaultExpiresInSeconds = 3600;
const expirySafetyBufferMs = 60_000;
const tokenRequestTimeoutMs = 30_000;

type SignnowTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

@Injectable()
export class SignnowTokenClient {
  private cachedToken: CachedToken | undefined;
  private inflightTokenRequest: Promise<string> | undefined;

  constructor(@Inject(APP_CONFIG) private readonly appConfig: AppConfig) {}

  async getAccessToken(): Promise<string> {
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt > Date.now() + expirySafetyBufferMs
    ) {
      return this.cachedToken.accessToken;
    }
    if (!this.inflightTokenRequest) {
      const tokenRequest = this.fetchAndCacheToken().finally(() => {
        if (this.inflightTokenRequest === tokenRequest) {
          this.inflightTokenRequest = undefined;
        }
      });
      this.inflightTokenRequest = tokenRequest;
    }
    return this.inflightTokenRequest;
  }

  invalidate(): void {
    this.cachedToken = undefined;
    this.inflightTokenRequest = undefined;
  }

  private async fetchAndCacheToken(): Promise<string> {
    const tokenUrl = `${this.appConfig.signnowBasePath}/oauth2/token`;
    const basicCredentials = Buffer.from(
      `${this.appConfig.signnowClientId}:${this.appConfig.signnowClientSecret}`,
    ).toString("base64");
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicCredentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: this.appConfig.signnowUserEmail,
        password: this.appConfig.signnowUserPassword,
        grant_type: passwordGrantType,
        scope: tokenScope,
      }),
      signal: AbortSignal.timeout(tokenRequestTimeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `signNow OAuth token request failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as SignnowTokenResponse;
    if (
      typeof body.access_token !== "string" ||
      body.access_token.length === 0
    ) {
      throw new Error("signNow OAuth response did not include an access_token");
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
}
