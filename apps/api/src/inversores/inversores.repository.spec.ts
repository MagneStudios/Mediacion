import { InversoresRepository } from "./inversores.repository";
import type { CreateInversorDto } from "./types";

function createFakeKysely(returned: unknown) {
  const executeTakeFirstOrThrow = jest.fn().mockResolvedValue(returned);
  const returningAll = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = jest.fn().mockReturnValue({ returningAll });
  const insertInto = jest.fn().mockReturnValue({ values });
  return { insertInto, values, returningAll, executeTakeFirstOrThrow };
}

const input: CreateInversorDto = {
  nombre: "Ana Pérez",
  email: "ana@example.com",
  capital_disponible: "10000",
  experiencia: "5 años en real estate",
};

describe("InversoresRepository", () => {
  it("returns the created inversor row on a successful insert", async () => {
    const created = { id: "inv-1", ...input };
    const fakeKysely = createFakeKysely(created);
    const repository = new InversoresRepository(fakeKysely as never);

    const result = await repository.create(input);

    expect(fakeKysely.insertInto).toHaveBeenCalledWith("inversores");
    expect(fakeKysely.values).toHaveBeenCalledWith({
      nombre: input.nombre,
      email: input.email,
      capital_disponible: input.capital_disponible,
      experiencia: input.experiencia,
    });
    expect(result).toBe(created);
  });
});
