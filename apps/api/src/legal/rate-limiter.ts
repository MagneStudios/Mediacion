import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";

function tooManyRequests(): HttpException {
  return new HttpException(
    { code: "too_many_requests", message: "Too many requests" },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class PublicRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(@Inject(APP_CONFIG) private readonly appConfig: AppConfig) {}

  assertWithinLimit(key: string, now: number = Date.now()): void {
    const windowStart = now - this.appConfig.legalPublicWindowMs;
    const recent = (this.hits.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );
    if (recent.length >= this.appConfig.legalPublicRequestsPerWindow) {
      this.hits.set(key, recent);
      throw tooManyRequests();
    }
    recent.push(now);
    this.hits.set(key, recent);
    this.forget(windowStart);
  }

  private forget(windowStart: number): void {
    for (const [key, timestamps] of this.hits) {
      if (timestamps.every((timestamp) => timestamp <= windowStart)) {
        this.hits.delete(key);
      }
    }
  }
}
