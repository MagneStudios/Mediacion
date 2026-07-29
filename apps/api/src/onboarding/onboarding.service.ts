import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { OnboardingRepository } from "./onboarding.repository";
import type {
  BiometriaDto,
  BiometriaState,
  ConsentimientoDto,
  ConsentimientoState,
} from "./onboarding.types";
import { recordableBiometricResults } from "./onboarding.types";

function profileNotFound(): HttpException {
  return new HttpException(
    { code: "profile_not_found", message: "Profile not found" },
    HttpStatus.NOT_FOUND,
  );
}

function assertValidBiometricResult(input: BiometriaDto): void {
  if (!recordableBiometricResults.includes(input?.resultado)) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: `resultado must be one of ${recordableBiometricResults.join(", ")}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function readEnvelopeId(input: ConsentimientoDto): string | null {
  const envelopeId = input?.envelope_id;
  if (envelopeId === undefined || envelopeId === null) {
    return null;
  }
  if (typeof envelopeId !== "string" || envelopeId.trim().length === 0) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: "envelope_id must be a non-empty string",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
  return envelopeId.trim();
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(OnboardingRepository)
    private readonly onboardingRepository: OnboardingRepository,
  ) {}

  async recordBiometricResult(
    callerId: string,
    input: BiometriaDto,
  ): Promise<BiometriaState> {
    assertValidBiometricResult(input);
    const updated = await this.onboardingRepository.recordBiometricResult(
      callerId,
      input.resultado,
    );
    if (!updated) {
      throw profileNotFound();
    }
    return updated;
  }

  async recordConsent(
    callerId: string,
    input: ConsentimientoDto,
  ): Promise<ConsentimientoState> {
    const envelopeId = readEnvelopeId(input);
    const recorded = await this.onboardingRepository.recordFirstConsent(
      callerId,
      envelopeId,
      new Date().toISOString(),
    );
    if (recorded) {
      return recorded;
    }
    const existing = await this.onboardingRepository.findConsent(callerId);
    if (!existing) {
      throw profileNotFound();
    }
    return existing;
  }
}
