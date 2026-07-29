import { OnboardingController } from "./onboarding.controller";

const caller = { id: "user-a" } as never;

describe("OnboardingController", () => {
  function createController() {
    const onboardingService = {
      recordBiometricResult: jest.fn().mockResolvedValue({ id: "user-a" }),
      recordConsent: jest.fn().mockResolvedValue({ id: "user-a" }),
    };
    return {
      onboardingService,
      controller: new OnboardingController(onboardingService as never),
    };
  }

  it("delegates the biometric outcome with the caller id", async () => {
    const { controller, onboardingService } = createController();

    await controller.recordBiometricResult(caller, { resultado: "aprobada" });

    expect(onboardingService.recordBiometricResult).toHaveBeenCalledWith(
      "user-a",
      { resultado: "aprobada" },
    );
  });

  it("delegates the consent with the caller id", async () => {
    const { controller, onboardingService } = createController();

    await controller.recordConsent(caller, { envelope_id: "envelope-1" });

    expect(onboardingService.recordConsent).toHaveBeenCalledWith("user-a", {
      envelope_id: "envelope-1",
    });
  });
});
