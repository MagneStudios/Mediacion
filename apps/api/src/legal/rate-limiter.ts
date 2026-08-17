import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import { RateLimitRepository } from "./rate-limit.repository";

const firstHit = 1;
const skewToleranceWindows = 2;

function tooManyRequests(): HttpException {
  return new HttpException(
    { code: "too_many_requests", message: "Too many requests" },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class PublicRateLimiter {
  private readonly logger = new Logger(PublicRateLimiter.name);

  constructor(
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    @Inject(RateLimitRepository)
    private readonly rateLimitRepository: RateLimitRepository,
  ) {}

  async assertWithinLimit(
    key: string,
    now: number = Date.now(),
  ): Promise<void> {
    const windowMs = this.appConfig.legalPublicWindowMs;
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const windowStart = new Date(windowStartMs).toISOString();

    let hits: number;
    try {
      hits = await this.rateLimitRepository.countHit(key, windowStart);
    } catch (error) {
      this.logger.error(
        `legal.rateLimiter could not reach the shared counter, letting the request through for ${key}`,
        error,
      );
      return;
    }

    if (hits === firstHit) {
      await this.sweepExpiredWindows(windowStartMs, windowMs);
    }

    if (hits > this.appConfig.legalPublicRequestsPerWindow) {
      throw tooManyRequests();
    }
  }

  private async sweepExpiredWindows(
    windowStartMs: number,
    windowMs: number,
  ): Promise<void> {
    const cutoff = new Date(
      windowStartMs - windowMs * skewToleranceWindows,
    ).toISOString();
    try {
      await this.rateLimitRepository.forgetWindowsBefore(cutoff);
    } catch (error) {
      this.logger.error(
        `legal.rateLimiter could not sweep expired windows before ${cutoff}`,
        error,
      );
    }
  }
}
