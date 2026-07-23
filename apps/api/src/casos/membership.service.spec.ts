import { HttpException } from "@nestjs/common";
import { estadoInvitacionAceptada } from "./casos.types";
import { MembershipService } from "./membership.service";

describe("MembershipService", () => {
  function createFakeKysely(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const where3 = jest.fn().mockReturnValue({ executeTakeFirst });
    const where2 = jest.fn().mockReturnValue({ where: where3 });
    const where1 = jest.fn().mockReturnValue({ where: where2 });
    const select = jest.fn().mockReturnValue({ where: where1 });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return { selectFrom, select, where1, where2, where3, executeTakeFirst };
  }

  it("returns the caller's caso_partes row when accepted membership exists", async () => {
    const row = {
      id: "parte-1",
      caso_id: "caso-1",
      usuario_id: "user-1",
      rol_en_caso: "parte_a",
      estado_invitacion: estadoInvitacionAceptada,
    };
    const fakeKysely = createFakeKysely(row);
    const service = new MembershipService(fakeKysely as never);

    const result = await service.assertMembership("caso-1", "user-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("caso_partes");
    expect(fakeKysely.where1).toHaveBeenCalledWith("caso_id", "=", "caso-1");
    expect(fakeKysely.where2).toHaveBeenCalledWith("usuario_id", "=", "user-1");
    expect(fakeKysely.where3).toHaveBeenCalledWith(
      "estado_invitacion",
      "=",
      estadoInvitacionAceptada,
    );
    expect(result).toBe(row);
  });

  it("throws a 404 when the caller has no accepted membership row", async () => {
    const fakeKysely = createFakeKysely(undefined);
    const service = new MembershipService(fakeKysely as never);

    let thrown: unknown;
    try {
      await service.assertMembership("caso-1", "stranger");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
    expect((thrown as HttpException).getResponse()).toEqual({
      code: "caso_not_found",
      message: "Case not found",
    });
  });
});
