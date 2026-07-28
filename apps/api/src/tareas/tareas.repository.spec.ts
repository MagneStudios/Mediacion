import { TareasRepository } from "./tareas.repository";

const tareaRow = {
  id: "tarea-1",
  acuerdo_id: "acuerdo-1",
  caso_id: "caso-1",
  tipo: "tarea",
  descripcion: "Bienes — cumplir lo acordado",
  fecha_evento: null,
  estado: "pendiente",
  created_at: "2026-07-28T10:00:00.000Z",
  updated_at: "2026-07-28T10:00:00.000Z",
};

describe("TareasRepository", () => {
  describe("listByCaso", () => {
    function createFakeKysely(rows: unknown[]) {
      const execute = jest.fn().mockResolvedValue(rows);
      const orderBy = jest.fn().mockReturnValue({ execute });
      const where = jest.fn().mockReturnValue({ orderBy });
      const select = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, where, orderBy, execute };
    }

    it("reads the allowlisted columns for the case ordered by creation", async () => {
      const fakeKysely = createFakeKysely([tareaRow]);
      const repository = new TareasRepository(fakeKysely as never);

      const result = await repository.listByCaso("caso-1");

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("tareas");
      expect(fakeKysely.select).toHaveBeenCalledWith([
        "id",
        "acuerdo_id",
        "caso_id",
        "tipo",
        "descripcion",
        "fecha_evento",
        "estado",
        "created_at",
        "updated_at",
      ]);
      expect(fakeKysely.where).toHaveBeenCalledWith("caso_id", "=", "caso-1");
      expect(fakeKysely.orderBy).toHaveBeenCalledWith("created_at", "asc");
      expect(result).toEqual([tareaRow]);
    });
  });

  describe("findById", () => {
    function createFakeKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const selectAll = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ selectAll });
      return { selectFrom, selectAll, where, executeTakeFirst };
    }

    it("reads a single tarea by id", async () => {
      const fakeKysely = createFakeKysely(tareaRow);
      const repository = new TareasRepository(fakeKysely as never);

      const result = await repository.findById("tarea-1");

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("tareas");
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "tarea-1");
      expect(result).toBe(tareaRow);
    });

    it("resolves undefined when the tarea does not exist", async () => {
      const fakeKysely = createFakeKysely(undefined);
      const repository = new TareasRepository(fakeKysely as never);

      await expect(repository.findById("missing")).resolves.toBeUndefined();
    });
  });

  describe("updateEstado", () => {
    function createFakeKysely(row: unknown, executeError?: unknown) {
      const executeTakeFirst = executeError
        ? jest.fn().mockRejectedValue(executeError)
        : jest.fn().mockResolvedValue(row);
      const returning = jest.fn().mockReturnValue({ executeTakeFirst });
      const where = jest.fn().mockReturnValue({ returning });
      const set = jest.fn().mockReturnValue({ where });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where, returning, executeTakeFirst };
    }

    it("writes the new estado and returns the updated view", async () => {
      const updated = { ...tareaRow, estado: "completada" };
      const fakeKysely = createFakeKysely(updated);
      const repository = new TareasRepository(fakeKysely as never);

      const result = await repository.updateEstado("tarea-1", "completada");

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("tareas");
      expect(fakeKysely.set).toHaveBeenCalledWith({ estado: "completada" });
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "tarea-1");
      expect(result).toBe(updated);
    });

    it("throws tarea_not_found when no row was updated", async () => {
      const fakeKysely = createFakeKysely(undefined);
      const repository = new TareasRepository(fakeKysely as never);

      await expect(
        repository.updateEstado("missing", "completada"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "tarea_not_found" },
      });
    });

    it("maps driver errors through toDomainError", async () => {
      const pgUniqueViolation = Object.assign(new Error("duplicate"), {
        code: "23505",
      });
      const fakeKysely = createFakeKysely(undefined, pgUniqueViolation);
      const repository = new TareasRepository(fakeKysely as never);

      await expect(
        repository.updateEstado("tarea-1", "completada"),
      ).rejects.toMatchObject({ status: 409, response: { code: "conflict" } });
    });
  });

  describe("scheduleCalendarEvent", () => {
    function createFakeKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const returning = jest.fn().mockReturnValue({ executeTakeFirst });
      const where = jest.fn().mockReturnValue({ returning });
      const set = jest.fn().mockReturnValue({ where });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where, returning, executeTakeFirst };
    }

    it("promotes the accionable to a calendar event with its date", async () => {
      const updated = {
        ...tareaRow,
        tipo: "evento_calendario",
        fecha_evento: "2026-08-15T13:30:00.000Z",
      };
      const fakeKysely = createFakeKysely(updated);
      const repository = new TareasRepository(fakeKysely as never);

      const result = await repository.scheduleCalendarEvent(
        "tarea-1",
        "2026-08-15T13:30:00.000Z",
      );

      expect(fakeKysely.set).toHaveBeenCalledWith({
        tipo: "evento_calendario",
        fecha_evento: "2026-08-15T13:30:00.000Z",
      });
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "tarea-1");
      expect(result).toBe(updated);
    });

    it("throws tarea_not_found when no row was updated", async () => {
      const fakeKysely = createFakeKysely(undefined);
      const repository = new TareasRepository(fakeKysely as never);

      await expect(
        repository.scheduleCalendarEvent("missing", "2026-08-15T13:30:00.000Z"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "tarea_not_found" },
      });
    });
  });

  describe("insertGenerated", () => {
    function createFakeTransaction(existing: unknown, inserted: unknown[]) {
      const existingExecuteTakeFirst = jest.fn().mockResolvedValue(existing);
      const existingWhere = jest
        .fn()
        .mockReturnValue({ executeTakeFirst: existingExecuteTakeFirst });
      const existingSelect = jest
        .fn()
        .mockReturnValue({ where: existingWhere });
      const selectFrom = jest.fn().mockReturnValue({ select: existingSelect });

      const insertExecute = jest.fn().mockResolvedValue(inserted);
      const returningAll = jest
        .fn()
        .mockReturnValue({ execute: insertExecute });
      const onConflict = jest.fn().mockReturnValue({ returningAll });
      const values = jest.fn().mockReturnValue({ onConflict });
      const insertInto = jest.fn().mockReturnValue({ values });

      const trx = { selectFrom, insertInto };
      const execute = jest.fn((callback: (t: unknown) => unknown) =>
        Promise.resolve(callback(trx)),
      );
      const transaction = jest.fn().mockReturnValue({ execute });
      return {
        transaction,
        selectFrom,
        existingWhere,
        insertInto,
        values,
        onConflict,
        insertExecute,
      };
    }

    const generated = [
      {
        acuerdo_id: "acuerdo-1",
        caso_id: "caso-1",
        tipo: "tarea" as const,
        descripcion: "Bienes — cumplir lo acordado",
      },
    ];

    it("inserts the generated accionables when the acuerdo has none", async () => {
      const fakeKysely = createFakeTransaction(undefined, [tareaRow]);
      const repository = new TareasRepository(fakeKysely as never);

      const result = await repository.insertGenerated("acuerdo-1", generated);

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("tareas");
      expect(fakeKysely.existingWhere).toHaveBeenCalledWith(
        "acuerdo_id",
        "=",
        "acuerdo-1",
      );
      expect(fakeKysely.insertInto).toHaveBeenCalledWith("tareas");
      expect(fakeKysely.values).toHaveBeenCalledWith(generated);
      expect(result).toEqual([tareaRow]);
    });

    it("defers to the unique index when a concurrent run inserts first", async () => {
      const fakeKysely = createFakeTransaction(undefined, [tareaRow]);
      const repository = new TareasRepository(fakeKysely as never);
      const doNothing = jest.fn().mockReturnValue("do-nothing");
      const columns = jest.fn().mockReturnValue({ doNothing });

      await repository.insertGenerated("acuerdo-1", generated);

      const conflictBuilder = fakeKysely.onConflict.mock.calls[0][0];
      conflictBuilder({ columns });

      expect(columns).toHaveBeenCalledWith(["acuerdo_id", "descripcion"]);
      expect(doNothing).toHaveBeenCalled();
    });

    it("is idempotent — skips insertion when the acuerdo already has tareas", async () => {
      const fakeKysely = createFakeTransaction({ id: "tarea-existente" }, []);
      const repository = new TareasRepository(fakeKysely as never);

      const result = await repository.insertGenerated("acuerdo-1", generated);

      expect(fakeKysely.insertInto).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("skips the transaction entirely when nothing was generated", async () => {
      const fakeKysely = createFakeTransaction(undefined, []);
      const repository = new TareasRepository(fakeKysely as never);

      const result = await repository.insertGenerated("acuerdo-1", []);

      expect(fakeKysely.transaction).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
