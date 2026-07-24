import { ConflictError } from "../common/errors/domain-errors";
import { EstudiosRepository } from "./estudios.repository";

function createFakeUpdateKysely(returned: unknown, rejection?: unknown) {
  const executeTakeFirst = rejection
    ? jest.fn().mockRejectedValue(rejection)
    : jest.fn().mockResolvedValue(returned);
  const returningAll = jest.fn().mockReturnValue({ executeTakeFirst });
  const where = jest.fn().mockReturnValue({ returningAll });
  const set = jest.fn().mockReturnValue({ where });
  const updateTable = jest.fn().mockReturnValue({ set });
  return { updateTable, set, where, returningAll, executeTakeFirst };
}

describe("EstudiosRepository", () => {
  describe("updateMarcaConfig", () => {
    it("returns the updated estudio row on a successful update", async () => {
      const updated = { id: "estudio-1", marca_config: { color: "#fff" } };
      const fakeKysely = createFakeUpdateKysely(updated);
      const repository = new EstudiosRepository(fakeKysely as never);

      const result = await repository.updateMarcaConfig("estudio-1", {
        color: "#fff",
      });

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("estudios");
      expect(fakeKysely.set).toHaveBeenCalledWith({
        marca_config: { color: "#fff" },
      });
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "estudio-1");
      expect(result).toBe(updated);
    });

    it("maps a pg unique-violation 23505 to a domain ConflictError", async () => {
      const fakeKysely = createFakeUpdateKysely(undefined, {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      });
      const repository = new EstudiosRepository(fakeKysely as never);

      await expect(
        repository.updateMarcaConfig("estudio-1", { color: "#fff" }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("maps a pg trigger exception P0001 to a domain ConflictError", async () => {
      const fakeKysely = createFakeUpdateKysely(undefined, {
        code: "P0001",
        message: "invalid marca_config",
      });
      const repository = new EstudiosRepository(fakeKysely as never);

      await expect(
        repository.updateMarcaConfig("estudio-1", { color: "#fff" }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
