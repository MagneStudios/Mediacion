import { IncumplimientosRepository } from "./incumplimientos.repository";

const registered = {
  id: "incumplimiento-1",
  acuerdo_id: "acuerdo-1",
  reportante_id: "user-a",
  descripcion: "No cumplió el cronograma",
  fecha: "2026-07-28T10:00:00.000Z",
  created_at: "2026-07-28T10:00:00.000Z",
};

describe("IncumplimientosRepository", () => {
  describe("findAcuerdo", () => {
    it("reads only the fields needed to authorize a breach notice", async () => {
      const executeTakeFirst = jest
        .fn()
        .mockResolvedValue({ id: "acuerdo-1", caso_id: "caso-1" });
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const select = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ select });
      const repository = new IncumplimientosRepository({ selectFrom } as never);

      await repository.findAcuerdo("acuerdo-1");

      expect(selectFrom).toHaveBeenCalledWith("acuerdos");
      expect(select).toHaveBeenCalledWith(["id", "caso_id", "estado"]);
      expect(where).toHaveBeenCalledWith("id", "=", "acuerdo-1");
    });
  });

  describe("listByAcuerdo", () => {
    it("reads the allowlisted columns newest first", async () => {
      const execute = jest.fn().mockResolvedValue([registered]);
      const orderBy = jest.fn().mockReturnValue({ execute });
      const where = jest.fn().mockReturnValue({ orderBy });
      const select = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ select });
      const repository = new IncumplimientosRepository({ selectFrom } as never);

      const result = await repository.listByAcuerdo("acuerdo-1");

      expect(selectFrom).toHaveBeenCalledWith("incumplimientos");
      expect(select).toHaveBeenCalledWith([
        "id",
        "acuerdo_id",
        "reportante_id",
        "descripcion",
        "fecha",
        "created_at",
      ]);
      expect(where).toHaveBeenCalledWith("acuerdo_id", "=", "acuerdo-1");
      expect(orderBy).toHaveBeenCalledWith("fecha", "desc");
      expect(result).toEqual([registered]);
    });
  });

  describe("registerBreach", () => {
    function createFakeKysely(insertError?: unknown) {
      const executeTakeFirstOrThrow = insertError
        ? jest.fn().mockRejectedValue(insertError)
        : jest.fn().mockResolvedValue(registered);
      const returning = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const values = jest.fn().mockReturnValue({ returning });
      const insertInto = jest.fn().mockReturnValue({ values });

      const updateExecute = jest.fn().mockResolvedValue(undefined);
      const updateWhere = jest.fn().mockReturnValue({ execute: updateExecute });
      const set = jest.fn().mockReturnValue({ where: updateWhere });
      const updateTable = jest.fn().mockReturnValue({ set });

      const trx = { insertInto, updateTable };
      const execute = jest.fn((callback: (t: unknown) => unknown) =>
        Promise.resolve(callback(trx)),
      );
      const transaction = jest.fn().mockReturnValue({ execute });
      return {
        transaction,
        insertInto,
        values,
        updateTable,
        set,
        updateWhere,
      };
    }

    it("inserts the notice and flags the agreement con_aviso in one transaction", async () => {
      const fakeKysely = createFakeKysely();
      const repository = new IncumplimientosRepository(fakeKysely as never);

      const result = await repository.registerBreach(
        "acuerdo-1",
        "user-a",
        "No cumplió el cronograma",
      );

      expect(fakeKysely.insertInto).toHaveBeenCalledWith("incumplimientos");
      expect(fakeKysely.values).toHaveBeenCalledWith({
        acuerdo_id: "acuerdo-1",
        reportante_id: "user-a",
        descripcion: "No cumplió el cronograma",
      });
      expect(fakeKysely.updateTable).toHaveBeenCalledWith("acuerdos");
      expect(fakeKysely.set).toHaveBeenCalledWith({ estado: "con_aviso" });
      expect(fakeKysely.updateWhere).toHaveBeenCalledWith(
        "id",
        "=",
        "acuerdo-1",
      );
      expect(result).toBe(registered);
    });

    it("maps driver errors through toDomainError", async () => {
      const pgUniqueViolation = Object.assign(new Error("duplicate"), {
        code: "23505",
      });
      const fakeKysely = createFakeKysely(pgUniqueViolation);
      const repository = new IncumplimientosRepository(fakeKysely as never);

      await expect(
        repository.registerBreach("acuerdo-1", "user-a", "Aviso"),
      ).rejects.toMatchObject({ status: 409, response: { code: "conflict" } });
    });
  });
});
