import { HttpException } from "@nestjs/common";
import type { UsersRepository } from "../auth/users.repository";
import { PlanLimitService } from "./plan-limit.service";

describe("PlanLimitService", () => {
  function buildService(overrides?: {
    executeTakeFirst?: jest.Mock;
    countRow?: { count: string | number } | undefined;
    findProfileById?: jest.Mock;
  }) {
    const executeTakeFirst =
      overrides?.executeTakeFirst ?? jest.fn().mockResolvedValue(undefined);
    const countExecuteTakeFirst = jest
      .fn()
      .mockResolvedValue(overrides?.countRow ?? { count: 0 });
    const where = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({ executeTakeFirst }),
      executeTakeFirst: countExecuteTakeFirst,
    });
    const select = jest.fn().mockReturnValue({ where });
    const innerJoin = jest.fn().mockReturnValue({ select });
    const selectFrom = jest.fn().mockReturnValue({ innerJoin, select });
    const kysely = { selectFrom };
    const usersRepository = {
      findProfileById:
        overrides?.findProfileById ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as UsersRepository;
    return {
      service: new PlanLimitService(kysely as never, usersRepository),
      usersRepository,
    };
  }

  it("never blocks when the caller's active plan limite_casos is -1 (unlimited)", async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ limite_casos: -1 });
    const { service } = buildService({ executeTakeFirst });

    await expect(
      service.assertCanCreateCase("user-1"),
    ).resolves.toBeUndefined();
  });

  it("never blocks when the caller's active plan limite_casos is null (unlimited)", async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ limite_casos: null });
    const { service } = buildService({ executeTakeFirst });

    await expect(
      service.assertCanCreateCase("user-1"),
    ).resolves.toBeUndefined();
  });

  it("rejects when the caller already has as many casos as the plan's limite_casos", async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ limite_casos: 5 });
    const { service } = buildService({
      executeTakeFirst,
      countRow: { count: 5 },
    });

    let thrown: unknown;
    try {
      await service.assertCanCreateCase("user-1");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(403);
  });

  it("allows creation when the caller is under the plan's limite_casos", async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ limite_casos: 5 });
    const { service } = buildService({
      executeTakeFirst,
      countRow: { count: 2 },
    });

    await expect(
      service.assertCanCreateCase("user-1"),
    ).resolves.toBeUndefined();
  });

  it("does not block when the caller has no active suscripcion at all (personal or estudio)", async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue(undefined);
    const findProfileById = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ executeTakeFirst, findProfileById });

    await expect(
      service.assertCanCreateCase("user-1"),
    ).resolves.toBeUndefined();
  });
});
