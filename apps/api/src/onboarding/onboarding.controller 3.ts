import { Body, Controller, Inject, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { OnboardingService } from "./onboarding.service";
import type {
  BiometriaDto,
  BiometriaState,
  ConsentimientoDto,
  ConsentimientoState,
} from "./onboarding.types";

@Controller("auth")
export class OnboardingController {
  constructor(
    @Inject(OnboardingService)
    private readonly onboardingService: OnboardingService,
  ) {}

  @Post("biometria")
  recordBiometricResult(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: BiometriaDto,
  ): Promise<BiometriaState> {
    return this.onboardingService.recordBiometricResult(caller.id, body);
  }

  @Post("consentimiento")
  recordConsent(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: ConsentimientoDto,
  ): Promise<ConsentimientoState> {
    return this.onboardingService.recordConsent(caller.id, body);
  }
}
