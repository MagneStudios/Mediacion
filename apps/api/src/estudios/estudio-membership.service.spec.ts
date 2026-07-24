import { HttpException } from "@nestjs/common";
import { EstudioMembershipService } from "./estudio-membership.service";

describe("EstudioMembershipService", () => {
  function createFakeKysely(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const where = jest.fn().mockReturnValue({ executeTakeFirst });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return { selectFrom, select, where, executeTakeFirst };
  }

  it("bypasses the lookup and returns the path id for an admin caller", async () => {
    const fakeKysely = createFakeKysely(undefined);
    const service = new EstudioMembershipService(fakeKysely as never);

    const result = await service.assertEstudioAccess(
      "admin-1",
      "admin",
      "estudio-a",
    );

    expect(result).toBe("estudio-a");
    expect(fakeKysely.selectFrom).not.toHaveBeenCalled();
  });

  it("resolves the path id for a non-admin caller whose usuarios.estudio_id matches it", async () => {
    const fakeKysely = createFakeKysely({ estudio_id: "estudio-a" });
    const service = new EstudioMembershipService(fakeKysely as never);

    const result = await service.assertEstudioAccess(
      "user-1",
      "estudio",
      "estudio-a",
    );

    expect(result).toBe("estudio-a");
    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("usuarios");
    expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "user-1");
  });

  it("throws a non-disclosing 404 when the caller's estudio_id differs from the path id", async () => {
    const fakeKysely = createFakeKysely({ estudio_id: "estudio-b" });
    const service = new EstudioMembershipService(fakeKysely as never);

    let thrown: unknown;
    try {
      await service.assertEstudioAccess("user-1", "estudio", "estudio-a");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
    expect((thrown as HttpException).getResponse()).toEqual({
      code: "estudio_not_found",
      message: "Estudio not found",
    });
  });

  it("throws a 404 when the caller's usuarios.estudio_id is null", async () => {
    const fakeKysely = createFakeKysely({ estudio_id: null });
    const service = new EstudioMembershipService(fakeKysely as never);

    let thrown: unknown;
    try {
      await service.assertEstudioAccess("user-1", "estudio", "estudio-a");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
  });
});
