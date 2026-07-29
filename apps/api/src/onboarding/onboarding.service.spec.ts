import { OnboardingService } from "./onboarding.service";

function createDeps() {
  return {
    onboardingRepository: {
      recordBiometricResult: jest
        .fn()
        .mockResolvedValue({ id: "user-a", verif_biometrica: "aprobada" }),
      recordFirstConsent: jest.fn().mockResolvedValue({
        id: "user-a",
        consentimiento_fecha: "2026-07-28T10:00:00.000Z",
        consentimiento_envelope_id: "envelope-1",
      }),
      findConsent: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function createService(deps = createDeps()) {
  return {
    ...deps,
    service: new OnboardingService(deps.onboardingRepository as never),
  };
}

describe("OnboardingService.recordBiometricResult", () => {
  it.each(["aprobada", "rechazada"])(
    "stores the %s verification outcome for the caller",
    async (resultado) => {
      const { service, onboardingRepository } = createService();

      await service.recordBiometricResult("user-a", {
        resultado: resultado as never,
      });

      expect(onboardingRepository.recordBiometricResult).toHaveBeenCalledWith(
        "user-a",
        resultado,
      );
    },
  );

  it.each(["pendiente", "otra", undefined])(
    "rejects %p — only a settled outcome may be recorded",
    async (resultado) => {
      const { service, onboardingRepository } = createService();

      await expect(
        service.recordBiometricResult("user-a", {
          resultado: resultado as never,
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
      expect(onboardingRepository.recordBiometricResult).not.toHaveBeenCalled();
    },
  );

  it("returns profile_not_found when the caller has no usuarios row", async () => {
    const deps = createDeps();
    deps.onboardingRepository.recordBiometricResult.mockResolvedValue(
      undefined,
    );
    const { service } = createService(deps);

    await expect(
      service.recordBiometricResult("ghost", { resultado: "aprobada" }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: "profile_not_found" },
    });
  });
});

describe("OnboardingService.recordConsent", () => {
  it("records the first consent with its DocuSign envelope", async () => {
    const { service, onboardingRepository } = createService();

    const result = await service.recordConsent("user-a", {
      envelope_id: "  envelope-1  ",
    });

    expect(onboardingRepository.recordFirstConsent).toHaveBeenCalledWith(
      "user-a",
      "envelope-1",
      expect.any(String),
    );
    expect(result.consentimiento_envelope_id).toBe("envelope-1");
  });

  it("accepts a consent with no envelope reference", async () => {
    const { service, onboardingRepository } = createService();

    await service.recordConsent("user-a", {});

    expect(onboardingRepository.recordFirstConsent).toHaveBeenCalledWith(
      "user-a",
      null,
      expect.any(String),
    );
  });

  it("rejects an empty envelope_id instead of storing a blank reference", async () => {
    const { service, onboardingRepository } = createService();

    await expect(
      service.recordConsent("user-a", { envelope_id: "   " }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "invalid_input" },
    });
    expect(onboardingRepository.recordFirstConsent).not.toHaveBeenCalled();
  });

  it("keeps the original consent timestamp when consent was already given", async () => {
    const alreadyConsented = {
      id: "user-a",
      consentimiento_fecha: "2026-01-01T00:00:00.000Z",
      consentimiento_envelope_id: "envelope-original",
    };
    const deps = createDeps();
    deps.onboardingRepository.recordFirstConsent.mockResolvedValue(undefined);
    deps.onboardingRepository.findConsent.mockResolvedValue(alreadyConsented);
    const { service } = createService(deps);

    const result = await service.recordConsent("user-a", {
      envelope_id: "envelope-nuevo",
    });

    expect(result).toBe(alreadyConsented);
  });

  it("returns profile_not_found when nothing was updated and no profile exists", async () => {
    const deps = createDeps();
    deps.onboardingRepository.recordFirstConsent.mockResolvedValue(undefined);
    deps.onboardingRepository.findConsent.mockResolvedValue(undefined);
    const { service } = createService(deps);

    await expect(service.recordConsent("ghost", {})).rejects.toMatchObject({
      status: 404,
      response: { code: "profile_not_found" },
    });
  });
});
