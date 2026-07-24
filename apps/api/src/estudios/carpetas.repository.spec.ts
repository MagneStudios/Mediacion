import { ConflictError } from "../common/errors/domain-errors";
import { CarpetasRepository } from "./carpetas.repository";

function createFakeSelectKysely(returned: unknown) {
  const execute = jest.fn().mockResolvedValue(returned);
  const where = jest.fn().mockReturnValue({ execute });
  const select = jest.fn().mockReturnValue({ where });
  const leftJoin = jest.fn().mockReturnValue({ select });
  const selectFrom = jest.fn().mockReturnValue({ leftJoin });
  return { selectFrom, leftJoin, select, where, execute };
}

function createFakeInsertKysely(returned: unknown, rejection?: unknown) {
  const executeTakeFirstOrThrow = rejection
    ? jest.fn().mockRejectedValue(rejection)
    : jest.fn().mockResolvedValue(returned);
  const returningAll = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = jest.fn().mockReturnValue({ returningAll });
  const insertInto = jest.fn().mockReturnValue({ values });
  return { insertInto, values, returningAll, executeTakeFirstOrThrow };
}

describe("CarpetasRepository", () => {
  describe("listCasosByCarpeta", () => {
    it("returns the casos scoped to the given estudio, joined with their carpeta", async () => {
      const casos = [
        {
          id: "caso-1",
          nombre: "Divorcio",
          carpeta_id: "carpeta-1",
          carpeta_nombre: "Familia",
        },
      ];
      const fakeKysely = createFakeSelectKysely(casos);
      const repository = new CarpetasRepository(fakeKysely as never);

      const result = await repository.listCasosByCarpeta("estudio-1");

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("casos");
      expect(fakeKysely.leftJoin).toHaveBeenCalledWith(
        "carpetas",
        "carpetas.id",
        "casos.carpeta_id",
      );
      expect(fakeKysely.where).toHaveBeenCalledWith(
        "casos.estudio_id",
        "=",
        "estudio-1",
      );
      expect(result).toBe(casos);
    });
  });

  describe("createCarpeta", () => {
    it("returns the created carpeta row on a successful insert", async () => {
      const created = {
        id: "carpeta-1",
        estudio_id: "estudio-1",
        nombre: "Familia",
      };
      const fakeKysely = createFakeInsertKysely(created);
      const repository = new CarpetasRepository(fakeKysely as never);

      const result = await repository.createCarpeta("estudio-1", "Familia");

      expect(fakeKysely.insertInto).toHaveBeenCalledWith("carpetas");
      expect(fakeKysely.values).toHaveBeenCalledWith({
        estudio_id: "estudio-1",
        nombre: "Familia",
      });
      expect(result).toBe(created);
    });

    it("maps a pg unique-violation 23505 to a domain ConflictError", async () => {
      const fakeKysely = createFakeInsertKysely(undefined, {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      });
      const repository = new CarpetasRepository(fakeKysely as never);

      await expect(
        repository.createCarpeta("estudio-1", "Familia"),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("maps a pg trigger exception P0001 to a domain ConflictError", async () => {
      const fakeKysely = createFakeInsertKysely(undefined, {
        code: "P0001",
        message: "invalid carpeta",
      });
      const repository = new CarpetasRepository(fakeKysely as never);

      await expect(
        repository.createCarpeta("estudio-1", "Familia"),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
