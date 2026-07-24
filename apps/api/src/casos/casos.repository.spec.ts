import { HttpStatus } from "@nestjs/common";
import { ConflictError } from "../common/errors/domain-errors";
import { CasosRepository } from "./casos.repository";
import type { CreateCasoDto } from "./casos.types";
import { estadoInvitacionAceptada } from "./casos.types";

describe("CasosRepository", () => {
  describe("createCaseWithParteA", () => {
    function createFakeTrxKyselyWithParteRejection(
      insertedCaso: unknown,
      parteError: unknown,
    ) {
      const casoExecuteTakeFirstOrThrow = jest
        .fn()
        .mockResolvedValue(insertedCaso);
      const casoReturningAll = jest.fn().mockReturnValue({
        executeTakeFirstOrThrow: casoExecuteTakeFirstOrThrow,
      });
      const casoValues = jest
        .fn()
        .mockReturnValue({ returningAll: casoReturningAll });

      const parteExecute = jest.fn().mockRejectedValue(parteError);
      const parteValues = jest.fn().mockReturnValue({ execute: parteExecute });

      const insertInto = jest.fn((table: string) => {
        if (table === "casos") {
          return { values: casoValues };
        }
        return { values: parteValues };
      });

      const trx = { insertInto };
      const execute = jest.fn((callback: (trx: unknown) => unknown) =>
        callback(trx),
      );
      const transaction = jest.fn().mockReturnValue({ execute });

      return { casoValues, parteValues, transaction };
    }

    it("maps a pg unique-violation raised by the parte_a insert to a uniform 409, leaking no db detail", async () => {
      const pgError = {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "caso_partes_caso_id_usuario_id_key"',
      };
      const fakeKysely = createFakeTrxKyselyWithParteRejection(
        { id: "caso-1" },
        pgError,
      );
      const repository = new CasosRepository(fakeKysely as never);
      const dto: CreateCasoDto = { nombre: "Divorcio", metodo: "mediacion" };

      let thrown: unknown;
      try {
        await repository.createCaseWithParteA(dto, "user-1");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      expect((thrown as ConflictError).getStatus()).toBe(HttpStatus.CONFLICT);
      const responseBody = JSON.stringify(
        (thrown as ConflictError).getResponse(),
      );
      expect(responseBody).toEqual('{"code":"conflict","message":"Conflict"}');
      expect(responseBody).not.toContain("caso_partes_caso_id_usuario_id_key");
    });

    it("propagates a rejection from the parte_a insert out of the transaction, proving both-or-neither", async () => {
      const connectionError = new Error("connection lost");
      const fakeKysely = createFakeTrxKyselyWithParteRejection(
        { id: "caso-1" },
        connectionError,
      );
      const repository = new CasosRepository(fakeKysely as never);
      const dto: CreateCasoDto = { nombre: "Divorcio", metodo: "mediacion" };

      await expect(
        repository.createCaseWithParteA(dto, "user-1"),
      ).rejects.toThrow("connection lost");
      expect(fakeKysely.casoValues).toHaveBeenCalledTimes(1);
      expect(fakeKysely.parteValues).toHaveBeenCalledTimes(1);
    });

    function createFakeTrxKysely(insertedCaso: unknown) {
      const casoExecuteTakeFirstOrThrow = jest
        .fn()
        .mockResolvedValue(insertedCaso);
      const casoReturningAll = jest.fn().mockReturnValue({
        executeTakeFirstOrThrow: casoExecuteTakeFirstOrThrow,
      });
      const casoValues = jest
        .fn()
        .mockReturnValue({ returningAll: casoReturningAll });

      const parteExecute = jest.fn().mockResolvedValue(undefined);
      const parteValues = jest.fn().mockReturnValue({ execute: parteExecute });

      const insertInto = jest.fn((table: string) => {
        if (table === "casos") {
          return { values: casoValues };
        }
        return { values: parteValues };
      });

      const trx = { insertInto };
      const execute = jest.fn((callback: (trx: unknown) => unknown) =>
        callback(trx),
      );
      const transaction = jest.fn().mockReturnValue({ execute });

      return {
        transaction,
        insertInto,
        casoValues,
        parteValues,
        casoExecuteTakeFirstOrThrow,
        parteExecute,
      };
    }

    it("inserts a casos row and a parte_a caso_partes row in the same transaction", async () => {
      const insertedCaso = {
        id: "caso-1",
        creador_id: "user-1",
        nombre: "Divorcio",
        descripcion: null,
        metodo: "mediacion",
        estado: "nuevo",
        created_at: "now",
        updated_at: "now",
      };
      const fakeKysely = createFakeTrxKysely(insertedCaso);
      const repository = new CasosRepository(fakeKysely as never);
      const dto: CreateCasoDto = { nombre: "Divorcio", metodo: "mediacion" };

      const result = await repository.createCaseWithParteA(dto, "user-1");

      expect(fakeKysely.transaction).toHaveBeenCalledTimes(1);
      expect(fakeKysely.insertInto).toHaveBeenCalledWith("casos");
      expect(fakeKysely.casoValues).toHaveBeenCalledWith(
        expect.objectContaining({
          creador_id: "user-1",
          nombre: "Divorcio",
          metodo: "mediacion",
        }),
      );
      expect(fakeKysely.insertInto).toHaveBeenCalledWith("caso_partes");
      expect(fakeKysely.parteValues).toHaveBeenCalledWith(
        expect.objectContaining({
          caso_id: "caso-1",
          usuario_id: "user-1",
          rol_en_caso: "parte_a",
          estado_invitacion: estadoInvitacionAceptada,
        }),
      );
      expect(result).toBe(insertedCaso);
    });

    it("never sets estado or ronda_actual explicitly on insert", async () => {
      const fakeKysely = createFakeTrxKysely({ id: "caso-1" });
      const repository = new CasosRepository(fakeKysely as never);
      const dto: CreateCasoDto = { nombre: "Divorcio", metodo: "mediacion" };

      await repository.createCaseWithParteA(dto, "user-1");

      const insertedValues = fakeKysely.casoValues.mock.calls[0][0];
      expect(insertedValues).not.toHaveProperty("estado");
      expect(insertedValues).not.toHaveProperty("ronda_actual");
    });
  });

  describe("findOwnCases", () => {
    function createBehavioralKysely(
      casosById: Record<string, { id: string }>,
      casoPartes: Array<{
        caso_id: string;
        usuario_id: string;
        estado_invitacion: string;
      }>,
    ) {
      const predicates: Array<[string, string, unknown]> = [];
      const chain: {
        selectFrom: jest.Mock;
        innerJoin: jest.Mock;
        select: jest.Mock;
        where: jest.Mock;
        execute: jest.Mock;
      } = {
        selectFrom: jest.fn(),
        innerJoin: jest.fn(),
        select: jest.fn(),
        where: jest.fn(),
        execute: jest.fn(),
      };
      chain.selectFrom.mockReturnValue(chain);
      chain.innerJoin.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      chain.where.mockImplementation(
        (column: string, _operator: string, value: unknown) => {
          predicates.push([column, _operator, value]);
          return chain;
        },
      );
      chain.execute.mockImplementation(async () => {
        const usuarioPredicate = predicates.find(
          ([column]) => column === "caso_partes.usuario_id",
        );
        const estadoPredicate = predicates.find(
          ([column]) => column === "caso_partes.estado_invitacion",
        );
        if (!usuarioPredicate || !estadoPredicate) {
          throw new Error(
            "findOwnCases must scope by both usuario_id and estado_invitacion",
          );
        }
        const callerId = usuarioPredicate[2];
        const requiredEstado = estadoPredicate[2];
        return casoPartes
          .filter(
            (parte) =>
              parte.usuario_id === callerId &&
              parte.estado_invitacion === requiredEstado,
          )
          .map((parte) => casosById[parte.caso_id]);
      });
      return chain;
    }

    it("returns only the caller's own accepted case, never another caller's case in the same table", async () => {
      const casoDeA = { id: "caso-a" };
      const casoDeB = { id: "caso-b" };
      const casosById = { "caso-a": casoDeA, "caso-b": casoDeB };
      const casoPartes = [
        {
          caso_id: "caso-a",
          usuario_id: "user-a",
          estado_invitacion: estadoInvitacionAceptada,
        },
        {
          caso_id: "caso-b",
          usuario_id: "user-b",
          estado_invitacion: estadoInvitacionAceptada,
        },
      ];

      const fakeKyselyForA = createBehavioralKysely(casosById, casoPartes);
      const repositoryForA = new CasosRepository(fakeKyselyForA as never);
      const resultForA = await repositoryForA.findOwnCases("user-a");
      expect(fakeKyselyForA.selectFrom).toHaveBeenCalledWith("casos");
      expect(fakeKyselyForA.innerJoin).toHaveBeenCalledWith(
        "caso_partes",
        "caso_partes.caso_id",
        "casos.id",
      );
      expect(resultForA).toEqual([casoDeA]);
      expect(resultForA).not.toContainEqual(casoDeB);

      const fakeKyselyForB = createBehavioralKysely(casosById, casoPartes);
      const repositoryForB = new CasosRepository(fakeKyselyForB as never);
      const resultForB = await repositoryForB.findOwnCases("user-b");
      expect(resultForB).toEqual([casoDeB]);
      expect(resultForB).not.toContainEqual(casoDeA);
    });
  });

  describe("findDetailForMember", () => {
    function createFakeSelectKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const where3 = jest.fn().mockReturnValue({ executeTakeFirst });
      const where2 = jest.fn().mockReturnValue({ where: where3 });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const select = jest.fn().mockReturnValue({ where: where1 });
      const innerJoin = jest.fn().mockReturnValue({ select });
      const selectFrom = jest.fn().mockReturnValue({ innerJoin });
      return {
        selectFrom,
        innerJoin,
        select,
        where1,
        where2,
        where3,
        executeTakeFirst,
      };
    }

    it("scopes the detail query by casoId and callerId membership, excluding items", async () => {
      const row = { id: "caso-1", nombre: "Divorcio" };
      const fakeKysely = createFakeSelectKysely(row);
      const repository = new CasosRepository(fakeKysely as never);

      const result = await repository.findDetailForMember("caso-1", "user-1");

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("casos");
      expect(fakeKysely.where1).toHaveBeenCalledWith("casos.id", "=", "caso-1");
      expect(fakeKysely.where2).toHaveBeenCalledWith(
        "caso_partes.usuario_id",
        "=",
        "user-1",
      );
      expect(fakeKysely.where3).toHaveBeenCalledWith(
        "caso_partes.estado_invitacion",
        "=",
        estadoInvitacionAceptada,
      );
      const selectedColumns = fakeKysely.select.mock.calls[0][0] as string[];
      expect(selectedColumns.some((column) => column.includes("item"))).toBe(
        false,
      );
      expect(result).toBe(row);
    });

    it("returns undefined when the caller has no membership row", async () => {
      const fakeKysely = createFakeSelectKysely(undefined);
      const repository = new CasosRepository(fakeKysely as never);

      const result = await repository.findDetailForMember("caso-1", "stranger");

      expect(result).toBeUndefined();
    });
  });

  describe("activateIfNuevo", () => {
    function createFakeTrx(execute: jest.Mock) {
      const where2 = jest.fn().mockReturnValue({ execute });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const set = jest.fn().mockReturnValue({ where: where1 });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where1, where2, execute };
    }

    it("activates a case from nuevo to activo using the provided trx, never touching ronda_actual", async () => {
      const fakeTrx = createFakeTrx(jest.fn().mockResolvedValue(undefined));
      const repository = new CasosRepository({} as never);

      await repository.activateIfNuevo("caso-1", fakeTrx as never);

      expect(fakeTrx.updateTable).toHaveBeenCalledWith("casos");
      expect(fakeTrx.set).toHaveBeenCalledWith({ estado: "activo" });
      expect(fakeTrx.where1).toHaveBeenCalledWith("id", "=", "caso-1");
      expect(fakeTrx.where2).toHaveBeenCalledWith("estado", "=", "nuevo");
      const updatedValues = fakeTrx.set.mock.calls[0][0];
      expect(updatedValues).not.toHaveProperty("ronda_actual");
    });

    it("maps a trigger-raised invalid-transition exception to a uniform 409 via the shared pg-error guard", async () => {
      const triggerError = {
        code: "P0001",
        message: "invalid caso estado transition",
      };
      const fakeTrx = createFakeTrx(jest.fn().mockRejectedValue(triggerError));
      const repository = new CasosRepository({} as never);

      let thrown: unknown;
      try {
        await repository.activateIfNuevo("caso-1", fakeTrx as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      expect((thrown as ConflictError).getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });

  describe("markAcordado", () => {
    function createFakeTrx(executeTakeFirstOrThrow: jest.Mock) {
      const returning = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const where2 = jest.fn().mockReturnValue({ returning });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const set = jest.fn().mockReturnValue({ where: where1 });
      const updateTable = jest.fn().mockReturnValue({ set });
      return {
        updateTable,
        set,
        where1,
        where2,
        returning,
        executeTakeFirstOrThrow,
      };
    }

    it("moves a case from en_negociacion to acordado using the provided trx, never touching ronda_actual", async () => {
      const executeTakeFirstOrThrow = jest
        .fn()
        .mockResolvedValue({ id: "caso-1" });
      const fakeTrx = createFakeTrx(executeTakeFirstOrThrow);
      const repository = new CasosRepository({} as never);

      await repository.markAcordado("caso-1", fakeTrx as never);

      expect(fakeTrx.updateTable).toHaveBeenCalledWith("casos");
      expect(fakeTrx.set).toHaveBeenCalledWith({ estado: "acordado" });
      expect(fakeTrx.where1).toHaveBeenCalledWith("id", "=", "caso-1");
      expect(fakeTrx.where2).toHaveBeenCalledWith(
        "estado",
        "=",
        "en_negociacion",
      );
      expect(fakeTrx.returning).toHaveBeenCalledWith(["id"]);
      const updatedValues = fakeTrx.set.mock.calls[0][0];
      expect(updatedValues).not.toHaveProperty("ronda_actual");
    });

    it("maps a trigger-raised invalid-transition exception to a uniform 409 via the shared pg-error guard", async () => {
      const triggerError = {
        code: "P0001",
        message: "invalid caso estado transition",
      };
      const executeTakeFirstOrThrow = jest.fn().mockRejectedValue(triggerError);
      const fakeTrx = createFakeTrx(executeTakeFirstOrThrow);
      const repository = new CasosRepository({} as never);

      let thrown: unknown;
      try {
        await repository.markAcordado("caso-1", fakeTrx as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      expect((thrown as ConflictError).getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it("throws a 409 inside the trx when zero rows match en_negociacion, rolling back instead of silently no-opping", async () => {
      const executeTakeFirstOrThrow = jest.fn(
        (errorConstructor: (node: unknown) => Error) =>
          Promise.reject(errorConstructor(undefined)),
      );
      const fakeTrx = createFakeTrx(executeTakeFirstOrThrow);
      const repository = new CasosRepository({} as never);

      let thrown: unknown;
      try {
        await repository.markAcordado("caso-1", fakeTrx as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      expect((thrown as ConflictError).getStatus()).toBe(HttpStatus.CONFLICT);
      expect(executeTakeFirstOrThrow).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe("updatePlazo", () => {
    function createFakeUpdateKysely(returnedRow: unknown) {
      const executeTakeFirstOrThrow = jest.fn().mockResolvedValue(returnedRow);
      const returning = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const where = jest.fn().mockReturnValue({ returning });
      const set = jest.fn().mockReturnValue({ where });
      const updateTable = jest.fn().mockReturnValue({ set });
      return {
        updateTable,
        set,
        where,
        returning,
        executeTakeFirstOrThrow,
      };
    }

    it("sets casos.plazo and returns the updated row, never touching estado", async () => {
      const returnedRow = { id: "caso-1", plazo: "2026-08-01T00:00:00.000Z" };
      const fakeKysely = createFakeUpdateKysely(returnedRow);
      const repository = new CasosRepository(fakeKysely as never);

      const result = await repository.updatePlazo(
        "caso-1",
        "2026-08-01T00:00:00.000Z",
      );

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("casos");
      expect(fakeKysely.set).toHaveBeenCalledWith({
        plazo: "2026-08-01T00:00:00.000Z",
      });
      const updatedValues = fakeKysely.set.mock.calls[0][0];
      expect(updatedValues).not.toHaveProperty("estado");
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "caso-1");
      expect(fakeKysely.returning).toHaveBeenCalledWith(["id", "plazo"]);
      expect(result).toBe(returnedRow);
    });

    it("wraps a raw query rejection into a domain error", async () => {
      const fakeKysely = createFakeUpdateKysely(undefined);
      fakeKysely.executeTakeFirstOrThrow.mockRejectedValue({
        code: "08006",
        message: "connection reset",
      });
      const repository = new CasosRepository(fakeKysely as never);

      await expect(
        repository.updatePlazo("caso-1", "2026-08-01T00:00:00.000Z"),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("findPlazo", () => {
    function createFakeSelectKysely(row: unknown) {
      const executeTakeFirst = jest.fn().mockResolvedValue(row);
      const where = jest.fn().mockReturnValue({ executeTakeFirst });
      const select = jest.fn().mockReturnValue({ where });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, where, executeTakeFirst };
    }

    it("returns the caso's id and plazo", async () => {
      const row = { id: "caso-1", plazo: "2026-08-01T00:00:00.000Z" };
      const fakeKysely = createFakeSelectKysely(row);
      const repository = new CasosRepository(fakeKysely as never);

      const result = await repository.findPlazo("caso-1");

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("casos");
      expect(fakeKysely.select).toHaveBeenCalledWith(["id", "plazo"]);
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "caso-1");
      expect(result).toBe(row);
    });

    it("returns undefined when the caso does not exist", async () => {
      const fakeKysely = createFakeSelectKysely(undefined);
      const repository = new CasosRepository(fakeKysely as never);

      const result = await repository.findPlazo("stranger-caso");

      expect(result).toBeUndefined();
    });
  });

  describe("findOverdueCasos", () => {
    function createFakeSelectKysely(rows: unknown) {
      const execute = jest.fn().mockResolvedValue(rows);
      const where3 = jest.fn().mockReturnValue({ execute });
      const where2 = jest.fn().mockReturnValue({ where: where3 });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const select = jest.fn().mockReturnValue({ where: where1 });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, where1, where2, where3, execute };
    }

    it("returns casos whose plazo has passed", async () => {
      const rows = [{ id: "caso-1" }];
      const fakeKysely = createFakeSelectKysely(rows);
      const repository = new CasosRepository(fakeKysely as never);
      const now = new Date("2026-07-24T12:00:00.000Z");

      const result = await repository.findOverdueCasos(now);

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("casos");
      expect(fakeKysely.where1).toHaveBeenCalledWith("plazo", "is not", null);
      expect(fakeKysely.where2).toHaveBeenCalledWith(
        "plazo",
        "<=",
        now.toISOString(),
      );
      expect(fakeKysely.where3).toHaveBeenCalledWith("estado", "in", [
        "nuevo",
        "activo",
        "en_negociacion",
      ]);
      expect(result).toBe(rows);
    });
  });
});
