import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { LegalController } from "./legal.controller";
import { LegalRepository } from "./legal.repository";
import { LegalService } from "./legal.service";
import { LegalAvisosController } from "./legal-avisos.controller";
import { LegalAvisosScheduler } from "./legal-avisos.scheduler";
import { RateLimitRepository } from "./rate-limit.repository";
import { PublicRateLimiter } from "./rate-limiter";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [LegalController, LegalAvisosController],
  providers: [
    LegalService,
    LegalRepository,
    LegalAvisosScheduler,
    PublicRateLimiter,
    RateLimitRepository,
  ],
})
export class LegalModule {}
