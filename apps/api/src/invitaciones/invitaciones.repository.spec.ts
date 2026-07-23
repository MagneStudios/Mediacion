import { HttpException, HttpStatus } from "@nestjs/common";
import { CasosRepository } from "../casos/casos.repository";
import { estadoInvitacionAceptada } from "../casos/casos.types";
import { ConflictError } from "../common/errors/domain-errors";
import { InvitacionesRepository } from "./invitaciones.repository";

describe("InvitacionesRepository", () => {
  describe("createInvite", () => {
    function createFakeKysely(returned: unknown, rejection?: unknown) {
      const executeTakeFirstOrThrow = rejection
        ? jest.fn().mockRejectedValue(rejection)
        : jest.fn().mockResolvedValue(returned);
      const returning = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const values = jest.fn().mockReturnValue({ returning });
      const insertInto = jest.fn().mockReturnValue({ values });
      return { insertInto, values, returning, executeTakeFirstOrThrow };
    }

    it("inserts an invitaciones row with the caso, tipo and generated token, pending by default", async () => {
      const inserted = {
        id: "inv-1",
        tipo: "link",
        token: "tok-abc",
        estado: "pendiente",
      };
      const fakeKysely = createFakeKysely(inserted);
      const casosRepository = new CasosRepository({} as never);
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      const result = await repository.createInvite("caso-1", "link", "tok-abc");

      expect(fakeKysely.insertInto).toHaveBeenCalledWith("invitaciones");
      expect(fakeKysely.values).toHaveBeenCalledWith({
        caso_id: "caso-1",
        tipo: "link",
        token: "tok-abc",
        estado: "pendiente",
      });
      expect(result).toBe(inserted);
    });

    it("maps a token unique-violation to a uniform 409, leaking no db detail", async () => {
      const pgError = {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "invitaciones_token_key"',
      };
      const fakeKysely = createFakeKysely(undefined, pgError);
      const casosRepository = new CasosRepository({} as never);
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      let thrown: unknown;
      try {
        await repository.createInvite("caso-1", "link", "tok-abc");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      const responseBody = JSON.stringify(
        (thrown as ConflictError).getResponse(),
      );
      expect(responseBody).not.toContain("invitaciones_token_key");
    });
  });

  describe("joinCase", () => {
    function createFakeTrx(options: {
      invitacion: { id: string; caso_id: string } | undefined;
      miembros: Array<{ usuario_id: string }>;
      caso: { id: string; estado: string } | undefined;
      activateRejection?: unknown;
      parteInsertRejection?: unknown;
    }) {
      const callOrder: string[] = [];

      const selectInvitacionExecuteTakeFirst = jest
        .fn()
        .mockResolvedValue(options.invitacion);
      const invitacionForUpdate = jest.fn().mockReturnValue({
        executeTakeFirst: selectInvitacionExecuteTakeFirst,
      });
      const invitacionWhere2 = jest
        .fn()
        .mockReturnValue({ forUpdate: invitacionForUpdate });
      const invitacionWhere1 = jest
        .fn()
        .mockReturnValue({ where: invitacionWhere2 });
      const invitacionSelectAll = jest
        .fn()
        .mockReturnValue({ where: invitacionWhere1 });

      const casoLockExecuteTakeFirst = jest.fn().mockImplementation(() => {
        callOrder.push("caso-lock");
        return Promise.resolve(
          options.caso ? { id: options.caso.id } : undefined,
        );
      });
      const casoLockForUpdate = jest
        .fn()
        .mockReturnValue({ executeTakeFirst: casoLockExecuteTakeFirst });
      const casoLockWhere = jest
        .fn()
        .mockReturnValue({ forUpdate: casoLockForUpdate });

      const miembrosExecute = jest.fn().mockImplementation(() => {
        callOrder.push("miembros-count");
        return Promise.resolve(options.miembros);
      });
      const miembrosWhere2 = jest
        .fn()
        .mockReturnValue({ execute: miembrosExecute });
      const miembrosWhere1 = jest
        .fn()
        .mockReturnValue({ where: miembrosWhere2 });
      const miembrosSelect = jest
        .fn()
        .mockReturnValue({ where: miembrosWhere1 });

      const parteExecute = options.parteInsertRejection
        ? jest.fn().mockRejectedValue(options.parteInsertRejection)
        : jest.fn().mockImplementation(() => {
            callOrder.push("parte-insert");
            return Promise.resolve(undefined);
          });
      const parteValues = jest.fn().mockReturnValue({ execute: parteExecute });

      const invitacionUpdateExecute = jest.fn().mockResolvedValue(undefined);
      const invitacionUpdateWhere = jest
        .fn()
        .mockReturnValue({ execute: invitacionUpdateExecute });
      const invitacionUpdateSet = jest
        .fn()
        .mockReturnValue({ where: invitacionUpdateWhere });

      const casoReadWhere = jest.fn().mockReturnValue({
        executeTakeFirstOrThrow: jest.fn().mockResolvedValue(options.caso),
      });
      const casoSelect = jest.fn((columns: unknown) => {
        if (columns === "id") {
          return { where: casoLockWhere };
        }
        return { where: casoReadWhere };
      });

      const selectFrom = jest.fn((table: string) => {
        if (table === "invitaciones") {
          return { selectAll: invitacionSelectAll };
        }
        if (table === "caso_partes") {
          return { select: miembrosSelect };
        }
        return { select: casoSelect };
      });

      const insertInto = jest.fn().mockReturnValue({ values: parteValues });
      const updateTable = jest
        .fn()
        .mockReturnValue({ set: invitacionUpdateSet });

      const trx = { selectFrom, insertInto, updateTable };
      const execute = jest.fn((callback: (trx: unknown) => unknown) =>
        callback(trx),
      );
      const transaction = jest.fn().mockReturnValue({ execute });

      return {
        transaction,
        insertInto,
        parteValues,
        parteExecute,
        updateTable,
        invitacionUpdateSet,
        invitacionUpdateWhere,
        selectInvitacionExecuteTakeFirst,
        casoSelect,
        casoLockWhere,
        casoLockForUpdate,
        casoLockExecuteTakeFirst,
        callOrder,
      };
    }

    it("returns a uniform 404 for a non-existent or already-used token, creating no rows", async () => {
      const fakeKysely = createFakeTrx({
        invitacion: undefined,
        miembros: [],
        caso: { id: "caso-1", estado: "activo" },
      });
      const casosRepository = {
        activateIfNuevo: jest.fn(),
      } as unknown as CasosRepository;
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      let thrown: unknown;
      try {
        await repository.joinCase("bad-token", "user-b");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(fakeKysely.insertInto).not.toHaveBeenCalled();
    });

    it("rejects a self-join with a 409, creating no rows", async () => {
      const fakeKysely = createFakeTrx({
        invitacion: { id: "inv-1", caso_id: "caso-1" },
        miembros: [{ usuario_id: "user-a" }],
        caso: { id: "caso-1", estado: "activo" },
      });
      const casosRepository = {
        activateIfNuevo: jest.fn(),
      } as unknown as CasosRepository;
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      let thrown: unknown;
      try {
        await repository.joinCase("tok-1", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      expect(fakeKysely.insertInto).not.toHaveBeenCalled();
    });

    it("rejects a join when the case already has two accepted parties, creating no rows", async () => {
      const fakeKysely = createFakeTrx({
        invitacion: { id: "inv-1", caso_id: "caso-1" },
        miembros: [{ usuario_id: "user-a" }, { usuario_id: "user-b" }],
        caso: { id: "caso-1", estado: "activo" },
      });
      const casosRepository = {
        activateIfNuevo: jest.fn(),
      } as unknown as CasosRepository;
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      let thrown: unknown;
      try {
        await repository.joinCase("tok-1", "user-c");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      expect(fakeKysely.insertInto).not.toHaveBeenCalled();
    });

    it("joins as parte_b, marks the invitation aceptada and activates the case atomically", async () => {
      const fakeKysely = createFakeTrx({
        invitacion: { id: "inv-1", caso_id: "caso-1" },
        miembros: [{ usuario_id: "user-a" }],
        caso: { id: "caso-1", estado: "activo" },
      });
      const activateIfNuevo = jest.fn().mockResolvedValue(undefined);
      const casosRepository = {
        activateIfNuevo,
      } as unknown as CasosRepository;
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      const result = await repository.joinCase("tok-1", "user-b");

      expect(fakeKysely.insertInto).toHaveBeenCalledWith("caso_partes");
      expect(fakeKysely.parteValues).toHaveBeenCalledWith(
        expect.objectContaining({
          caso_id: "caso-1",
          usuario_id: "user-b",
          rol_en_caso: "parte_b",
          estado_invitacion: estadoInvitacionAceptada,
        }),
      );
      expect(fakeKysely.updateTable).toHaveBeenCalledWith("invitaciones");
      expect(fakeKysely.invitacionUpdateSet).toHaveBeenCalledWith({
        estado: estadoInvitacionAceptada,
      });
      expect(fakeKysely.invitacionUpdateWhere).toHaveBeenCalledWith(
        "id",
        "=",
        "inv-1",
      );
      expect(activateIfNuevo).toHaveBeenCalledWith("caso-1", expect.anything());
      expect(fakeKysely.transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: "caso-1", estado: "activo" });
    });

    it("locks the casos row before counting members or inserting parte_b, serializing concurrent joins", async () => {
      const fakeKysely = createFakeTrx({
        invitacion: { id: "inv-1", caso_id: "caso-1" },
        miembros: [{ usuario_id: "user-a" }],
        caso: { id: "caso-1", estado: "activo" },
      });
      const activateIfNuevo = jest.fn().mockResolvedValue(undefined);
      const casosRepository = {
        activateIfNuevo,
      } as unknown as CasosRepository;
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      await repository.joinCase("tok-1", "user-b");

      expect(fakeKysely.casoSelect).toHaveBeenCalledWith("id");
      expect(fakeKysely.casoLockWhere).toHaveBeenCalledWith(
        "id",
        "=",
        "caso-1",
      );
      expect(fakeKysely.casoLockForUpdate).toHaveBeenCalled();
      expect(fakeKysely.callOrder).toEqual([
        "caso-lock",
        "miembros-count",
        "parte-insert",
      ]);
    });

    it("returns a uniform error instead of crashing when the invitation's case row is missing", async () => {
      const fakeKysely = createFakeTrx({
        invitacion: { id: "inv-1", caso_id: "caso-orphan" },
        miembros: [],
        caso: undefined,
      });
      const casosRepository = {
        activateIfNuevo: jest.fn(),
      } as unknown as CasosRepository;
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      let thrown: unknown;
      try {
        await repository.joinCase("tok-1", "user-b");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(fakeKysely.insertInto).not.toHaveBeenCalled();
    });

    it("maps a race-condition unique-violation on the caso_partes insert to a uniform 409", async () => {
      const pgError = {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "caso_partes_caso_id_usuario_id_key"',
      };
      const fakeKysely = createFakeTrx({
        invitacion: { id: "inv-1", caso_id: "caso-1" },
        miembros: [{ usuario_id: "user-a" }],
        caso: { id: "caso-1", estado: "activo" },
        parteInsertRejection: pgError,
      });
      const casosRepository = {
        activateIfNuevo: jest.fn(),
      } as unknown as CasosRepository;
      const repository = new InvitacionesRepository(
        fakeKysely as never,
        casosRepository,
      );

      let thrown: unknown;
      try {
        await repository.joinCase("tok-1", "user-b");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
    });
  });
});
