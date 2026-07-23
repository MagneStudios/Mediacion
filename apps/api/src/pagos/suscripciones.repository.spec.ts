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
