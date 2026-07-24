import { NotificacionesRepository } from "./notificaciones.repository";

describe("NotificacionesRepository", () => {
  describe("createPendiente", () => {
    function createFakeInsertKysely(insertedRow: unknown) {
      const executeTakeFirstOrThrow = jest.fn().mockResolvedValue(insertedRow);
      const returning = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const values = jest.fn().mockReturnValue({ returning });
      const insertInto = jest.fn().mockReturnValue({ values });
      return { insertInto, values, returning, executeTakeFirstOrThrow };
    }

    it("inserts a notificaciones row with estado='pendiente' before any dispatch", async () => {
      const fakeKysely = createFakeInsertKysely({ id: "notif-1" });
      const repository = new NotificacionesRepository(fakeKysely as never);

      const result = await repository.createPendiente({
        usuarioId: "user-1",
        casoId: "caso-1",
        canal: "email",
        evento: "invitacion_enviada",
      });

      expect(fakeKysely.insertInto).toHaveBeenCalledWith("notificaciones");
      expect(fakeKysely.values).toHaveBeenCalledWith({
        usuario_id: "user-1",
        caso_id: "caso-1",
        canal: "email",
        evento: "invitacion_enviada",
        estado: "pendiente",
      });
      expect(result).toEqual({ id: "notif-1" });
    });

    it("stores a null caso_id when the event has no associated caso", async () => {
      const fakeKysely = createFakeInsertKysely({ id: "notif-2" });
      const repository = new NotificacionesRepository(fakeKysely as never);

      await repository.createPendiente({
        usuarioId: "user-1",
        canal: "push",
        evento: "vencimiento",
      });

      expect(fakeKysely.values).toHaveBeenCalledWith(
        expect.objectContaining({ caso_id: null }),
      );
    });
  });

  describe("updateEstado", () => {
    function createFakeUpdateKysely() {
      const execute = jest.fn().mockResolvedValue(undefined);
      const where = jest.fn().mockReturnValue({ execute });
      const set = jest.fn().mockReturnValue({ where });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where, execute };
    }

    it("sets estado to 'enviada' and stamps fecha on settle", async () => {
      const fakeKysely = createFakeUpdateKysely();
      const repository = new NotificacionesRepository(fakeKysely as never);

      await repository.updateEstado("notif-1", "enviada");

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("notificaciones");
      const setArgs = fakeKysely.set.mock.calls[0][0];
      expect(setArgs.estado).toBe("enviada");
      expect(setArgs.fecha).toEqual(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "notif-1");
    });

    it("sets estado to 'fallida' and stamps fecha on settle", async () => {
      const fakeKysely = createFakeUpdateKysely();
      const repository = new NotificacionesRepository(fakeKysely as never);

      await repository.updateEstado("notif-2", "fallida");

      const setArgs = fakeKysely.set.mock.calls[0][0];
      expect(setArgs.estado).toBe("fallida");
      expect(setArgs.fecha).toEqual(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });
  });

  describe("findRecipientEmail", () => {
    function createFakeSelectKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const select = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, where, executeTakeFirst };
    }

    it("resolves the usuario email by id", async () => {
      const fakeKysely = createFakeSelectKysely({ email: "party@example.com" });
      const repository = new NotificacionesRepository(fakeKysely as never);

      const result = await repository.findRecipientEmail("user-1");

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("usuarios");
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "user-1");
      expect(result).toBe("party@example.com");
    });

    it("returns undefined when the usuario has no matching row", async () => {
      const fakeKysely = createFakeSelectKysely(undefined);
      const repository = new NotificacionesRepository(fakeKysely as never);

      const result = await repository.findRecipientEmail("stranger");

      expect(result).toBeUndefined();
    });

    it("wraps a raw query rejection into a domain error", async () => {
      const executeTakeFirst = jest
        .fn()
        .mockRejectedValue({ code: "08006", message: "connection reset" });
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const select = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ select });
      const fakeKysely = { selectFrom, select, where, executeTakeFirst };
      const repository = new NotificacionesRepository(fakeKysely as never);

      let thrown: unknown;
      try {
        await repository.findRecipientEmail("user-1");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
    });
  });
});
