import { ConflictError } from "../common/errors/domain-errors";
import type { CreateSuscripcionInput } from "./pagos.types";
import { SuscripcionesRepository } from "./suscripciones.repository";

function createFakeKysely(returned: unknown, rejection?: unknown) {
  const executeTakeFirstOrThrow = rejection
    ? jest.fn().mockRejectedValue(rejection)
    : jest.fn().mockResolvedValue(returned);
  const returningAll = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = jest.fn().mockReturnValue({ returningAll });
  const insertInto = jest.fn().mockReturnValue({ values });
  return { insertInto, values, returningAll, executeTakeFirstOrThrow };
}

const input: CreateSuscripcionInput = {
  plan_id: "plan-1",
  usuario_id: "user-1",
  estudio_id: null,
};

describe("SuscripcionesRepository", () => {
  it("returns the created suscripcion row on a successful insert", async () => {
    const created = { id: "sus-1", estado: "pendiente_pago" };
    const fakeKysely = createFakeKysely(created);
    const repository = new SuscripcionesRepository(fakeKysely as never);

    const result = await repository.createSuscripcion(input);

    expect(fakeKysely.insertInto).toHaveBeenCalledWith("suscripciones");
    expect(fakeKysely.values).toHaveBeenCalledWith({
      usuario_id: "user-1",
      estudio_id: null,
      plan_id: "plan-1",
    });
    expect(result).toBe(created);
  });

  it("maps a pg unique-violation 23505 to a domain ConflictError", async () => {
    const fakeKysely = createFakeKysely(undefined, {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await expect(repository.createSuscripcion(input)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("maps a pg trigger exception P0001 to a domain ConflictError", async () => {
    const fakeKysely = createFakeKysely(undefined, {
      code: "P0001",
      message: "plan already active",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await expect(repository.createSuscripcion(input)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("SuscripcionesRepository cancellation queries", () => {
  function createFakeSelect(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const where = jest.fn().mockReturnValue({ executeTakeFirst });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return { selectFrom, select, where, executeTakeFirst };
  }

  function createFakeUpdate(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const returningAll = jest.fn().mockReturnValue({ executeTakeFirst });
    const whereSecond = jest
      .fn()
      .mockReturnValue({ returningAll, executeTakeFirst });
    const whereFirst = jest.fn().mockReturnValue({ where: whereSecond });
    const set = jest.fn().mockReturnValue({ where: whereFirst });
    const updateTable = jest.fn().mockReturnValue({ set });
    return { updateTable, set, whereFirst, whereSecond, returningAll };
  }

  it("reads only the ownership columns needed to authorize the baja", async () => {
    const fakeKysely = createFakeSelect({
      id: "sus-1",
      usuario_id: "user-1",
      estudio_id: null,
      estado: "activa",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    const result = await repository.findOwnershipById("sus-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("suscripciones");
    expect(fakeKysely.select).toHaveBeenCalledWith([
      "id",
      "usuario_id",
      "estudio_id",
      "estado",
    ]);
    expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "sus-1");
    expect(result).toMatchObject({ estado: "activa" });
  });

  it("only cancels a suscripcion that is still activa, in a single statement", async () => {
    const fakeKysely = createFakeUpdate({
      id: "sus-1",
      estado: "cancelada",
      fecha_fin: "2026-08-15T12:00:00.000Z",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    const result = await repository.cancelActiva(
      "sus-1",
      "2026-08-15T12:00:00.000Z",
    );

    expect(fakeKysely.set).toHaveBeenCalledWith({
      estado: "cancelada",
      fecha_fin: "2026-08-15T12:00:00.000Z",
    });
    expect(fakeKysely.whereFirst).toHaveBeenCalledWith("id", "=", "sus-1");
    expect(fakeKysely.whereSecond).toHaveBeenCalledWith(
      "estado",
      "=",
      "activa",
    );
    expect(result).toMatchObject({ estado: "cancelada" });
  });

  it("returns undefined when the suscripcion was not activa, so the caller can raise a conflict", async () => {
    const fakeKysely = createFakeUpdate(undefined);
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await expect(
      repository.cancelActiva("sus-1", "2026-08-15T12:00:00.000Z"),
    ).resolves.toBeUndefined();
  });

  it("restores the suscripcion only if it is still the cancelada row we wrote", async () => {
    const fakeKysely = createFakeUpdate({});
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await repository.restoreActiva("sus-1");

    expect(fakeKysely.set).toHaveBeenCalledWith({
      estado: "activa",
      fecha_fin: null,
    });
    expect(fakeKysely.whereSecond).toHaveBeenCalledWith(
      "estado",
      "=",
      "cancelada",
    );
  });
});
