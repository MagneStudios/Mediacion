import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingRepository } from "./onboarding.repository";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingRepository],
})
export class OnboardingModule {}
