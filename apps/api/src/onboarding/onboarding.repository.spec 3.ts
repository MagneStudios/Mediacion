import { OnboardingRepository } from "./onboarding.repository";

describe("OnboardingRepository", () => {
  function createFakeUpdate(row: unknown, error?: unknown) {
    const executeTakeFirst = error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(row);
    const returning = jest.fn().mockReturnValue({ executeTakeFirst });
    const whereSecond = jest.fn().mockReturnValue({ returning });
    const whereFirst = jest
      .fn()
      .mockReturnValue({ returning, where: whereSecond });
    const set = jest.fn().mockReturnValue({ where: whereFirst });
    const updateTable = jest.fn().mockReturnValue({ set });
    return { updateTable, set, whereFirst, whereSecond, returning };
  }

  describe("recordBiometricResult", () => {
    it("writes verif_biometrica for the caller and returns the new state", async () => {
      const fakeKysely = createFakeUpdate({
        id: "user-a",
        verif_biometrica: "aprobada",
      });
      const repository = new OnboardingRepository(fakeKysely as never);

      const result = await repository.recordBiometricResult(
        "user-a",
        "aprobada",
      );

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("usuarios");
      expect(fakeKysely.set).toHaveBeenCalledWith({
        verif_biometrica: "aprobada",
      });
      expect(fakeKysely.whereFirst).toHaveBeenCalledWith("id", "=", "user-a");
      expect(fakeKysely.returning).toHaveBeenCalledWith([
        "id",
        "verif_biometrica",
      ]);
      expect(result).toEqual({ id: "user-a", verif_biometrica: "aprobada" });
    });

    it("maps driver errors through toDomainError", async () => {
      const fakeKysely = createFakeUpdate(
        undefined,
        Object.assign(new Error("duplicate"), { code: "23505" }),
      );
      const repository = new OnboardingRepository(fakeKysely as never);

      await expect(
        repository.recordBiometricResult("user-a", "aprobada"),
      ).rejects.toMatchObject({ status: 409, response: { code: "conflict" } });
    });
  });

  describe("recordFirstConsent", () => {
    it("only writes when no consent timestamp exists yet", async () => {
      const fakeKysely = createFakeUpdate({
        id: "user-a",
        consentimiento_fecha: "2026-07-28T10:00:00.000Z",
        consentimiento_envelope_id: "envelope-1",
      });
      const repository = new OnboardingRepository(fakeKysely as never);

      await repository.recordFirstConsent(
        "user-a",
        "envelope-1",
        "2026-07-28T10:00:00.000Z",
      );

      expect(fakeKysely.set).toHaveBeenCalledWith({
        consentimiento_fecha: "2026-07-28T10:00:00.000Z",
        consentimiento_envelope_id: "envelope-1",
      });
      expect(fakeKysely.whereFirst).toHaveBeenCalledWith("id", "=", "user-a");
      expect(fakeKysely.whereSecond).toHaveBeenCalledWith(
        "consentimiento_fecha",
        "is",
        null,
      );
    });
  });

  describe("findConsent", () => {
    it("reads the stored consent state", async () => {
      const executeTakeFirst = jest.fn().mockResolvedValue({ id: "user-a" });
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const select = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ select });
      const repository = new OnboardingRepository({ selectFrom } as never);

      await repository.findConsent("user-a");

      expect(selectFrom).toHaveBeenCalledWith("usuarios");
      expect(select).toHaveBeenCalledWith([
        "id",
        "consentimiento_fecha",
        "consentimiento_envelope_id",
      ]);
      expect(where).toHaveBeenCalledWith("id", "=", "user-a");
    });
  });
});
