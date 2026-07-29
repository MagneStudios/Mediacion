import { HttpException, HttpStatus } from "@nestjs/common";
import { AcuerdoAccessService } from "./acuerdo-access.service";

function caseNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

function createFakeKysely(row: unknown) {
  const executeTakeFirst = jest.fn().mockResolvedValue(row);
  const whereActivo = jest.fn().mockReturnValue({ executeTakeFirst });
  const whereRol = jest.fn().mockReturnValue({ where: whereActivo });
  const whereUser = jest.fn().mockReturnValue({ where: whereRol });
  const whereCaso = jest.fn().mockReturnValue({ where: whereUser });
  const select = jest.fn().mockReturnValue({ where: whereCaso });
  const innerJoin = jest.fn().mockReturnValue({ select });
  const selectFrom = jest.fn().mockReturnValue({ innerJoin });
  return {
    selectFrom,
    innerJoin,
    select,
    whereCaso,
    whereUser,
    whereRol,
    whereActivo,
  };
}

describe("AcuerdoAccessService", () => {
  it("grants access to an accepted party without querying the estudio fallback", async () => {
    const membershipService = {
      assertMembership: jest.fn().mockResolvedValue({}),
    };
    const fakeKysely = createFakeKysely(undefined);
    const service = new AcuerdoAccessService(
      membershipService as never,
      fakeKysely as never,
    );

    await expect(
      service.assertReadAccess("caso-1", "user-a"),
    ).resolves.toBeUndefined();
    expect(fakeKysely.selectFrom).not.toHaveBeenCalled();
  });

  it("grants access to a user whose estudio owns the case", async () => {
    const membershipService = {
      assertMembership: jest.fn().mockRejectedValue(caseNotFound()),
    };
    const fakeKysely = createFakeKysely({ id: "caso-1" });
    const service = new AcuerdoAccessService(
      membershipService as never,
      fakeKysely as never,
    );

    await expect(
      service.assertReadAccess("caso-1", "estudio-user"),
    ).resolves.toBeUndefined();
    expect(fakeKysely.innerJoin).toHaveBeenCalledWith(
      "usuarios",
      "usuarios.estudio_id",
      "casos.estudio_id",
    );
    expect(fakeKysely.whereCaso).toHaveBeenCalledWith(
      "casos.id",
      "=",
      "caso-1",
    );
    expect(fakeKysely.whereUser).toHaveBeenCalledWith(
      "usuarios.id",
      "=",
      "estudio-user",
    );
  });

  it("restricts the estudio fallback to an active user with the estudio role", async () => {
    const membershipService = {
      assertMembership: jest.fn().mockRejectedValue(caseNotFound()),
    };
    const fakeKysely = createFakeKysely({ id: "caso-1" });
    const service = new AcuerdoAccessService(
      membershipService as never,
      fakeKysely as never,
    );

    await service.assertReadAccess("caso-1", "estudio-user");

    expect(fakeKysely.whereRol).toHaveBeenCalledWith(
      "usuarios.rol",
      "=",
      "estudio",
    );
    expect(fakeKysely.whereActivo).toHaveBeenCalledWith(
      "usuarios.activo",
      "=",
      true,
    );
  });

  it("throws a non-disclosing caso_not_found for an unrelated user", async () => {
    const membershipService = {
      assertMembership: jest.fn().mockRejectedValue(caseNotFound()),
    };
    const service = new AcuerdoAccessService(
      membershipService as never,
      createFakeKysely(undefined) as never,
    );

    await expect(
      service.assertReadAccess("caso-1", "outsider"),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: "caso_not_found" },
    });
  });

  it("does not fall back to the estudio query on a non-404 failure", async () => {
    const membershipService = {
      assertMembership: jest
        .fn()
        .mockRejectedValue(new Error("connection lost")),
    };
    const fakeKysely = createFakeKysely({ id: "caso-1" });
    const service = new AcuerdoAccessService(
      membershipService as never,
      fakeKysely as never,
    );

    await expect(service.assertReadAccess("caso-1", "user-a")).rejects.toThrow(
      "connection lost",
    );
    expect(fakeKysely.selectFrom).not.toHaveBeenCalled();
  });
});
