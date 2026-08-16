import { createHash, timingSafeEqual } from "node:crypto";
import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import { LegalAvisosScheduler } from "./legal-avisos.scheduler";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function isAuthorizedCronRequest(
  authorizationHeader: string | undefined,
  cronSecret: string,
): boolean {
  if (!authorizationHeader) {
    return false;
  }
  return timingSafeEqual(
    sha256(authorizationHeader),
    sha256(`Bearer ${cronSecret}`),
  );
}

function invalidCronAuthorization(): HttpException {
  return new HttpException(
    {
      code: "invalid_cron_authorization",
      message: "Invalid cron authorization",
    },
    HttpStatus.UNAUTHORIZED,
  );
}

@Controller("internal/legal/avisos")
export class LegalAvisosController {
  constructor(
    @Inject(LegalAvisosScheduler)
    private readonly legalAvisosScheduler: LegalAvisosScheduler,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  @Public()
  @Get("sweep")
  async sweep(
    @Headers("authorization") authorization: string | undefined,
  ): Promise<{ swept: boolean }> {
    if (!isAuthorizedCronRequest(authorization, this.appConfig.cronSecret)) {
      throw invalidCronAuthorization();
    }
    await this.legalAvisosScheduler.runSweep(new Date());
    return { swept: true };
  }
}
