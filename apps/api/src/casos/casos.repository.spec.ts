import type { Database } from "@mediacion/db-types";
import { HttpStatus } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  ConflictError,
  QuotaExceededError,
} from "../common/errors/domain-errors";
import {
  buildRecomputeAcordadoQuery,
  CasosRepository,
} from "./casos.repository";
import type { CreateCasoDto } from "./casos.types";
import { estadoInvitacionAceptada } from "./casos.types";

/** Never connects: `.compile()` renders SQL without touching the pool. */
function createCompileOnlyKysely(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString:
          "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      }),
    }),
  });
}

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

    it("runs the beforeInsert hook on the transaction before inserting the caso", async () => {
      const fakeKysely = createFakeTrxKysely({ id: "caso-1" });
      const repository = new CasosRepository(fakeKysely as never);
      const seenTrx: unknown[] = [];
      const beforeInsert = jest.fn(async (trx: unknown) => {
        expect(fakeKysely.casoValues).not.toHaveBeenCalled();
        seenTrx.push(trx);
      });

      await repository.createCaseWithParteA(
        { nombre: "Divorcio", metodo: "mediacion" },
        "user-1",
        beforeInsert,
      );

      expect(beforeInsert).toHaveBeenCalledTimes(1);
      expect(fakeKysely.casoValues).toHaveBeenCalledTimes(1);
      expect(seenTrx[0]).toHaveProperty("insertInto", fakeKysely.insertInto);
    });

    it("aborts the whole transaction, inserting nothing, when the hook rejects (quota exceeded)", async () => {
      const fakeKysely = createFakeTrxKysely({ id: "caso-1" });
      const repository = new CasosRepository(fakeKysely as never);
      const beforeInsert = jest
        .fn()
        .mockRejectedValue(new QuotaExceededError(null, "QUOTA_EXCEEDED"));

      await expect(
        repository.createCaseWithParteA(
          { nombre: "Divorcio", metodo: "mediacion" },
          "user-1",
          beforeInsert,
        ),
      ).rejects.toBeInstanceOf(QuotaExceededError);
      expect(fakeKysely.casoValues).not.toHaveBeenCalled();
      expect(fakeKysely.parteValues).not.toHaveBeenCalled();
    });

    it("keeps working without a hook", async () => {
      const fakeKysely = createFakeTrxKysely({ id: "caso-1" });
      const repository = new CasosRepository(fakeKysely as never);

      await expect(
        repository.createCaseWithParteA(
          { nombre: "Divorcio", metodo: "mediacion" },
          "user-1",
        ),
      ).resolves.toEqual({ id: "caso-1" });
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
      const selectRondaActual = jest.fn().mockReturnValue({ where: where1 });
      const select = jest
        .fn()
        .mockReturnValue({ select: selectRondaActual, where: where1 });
      const innerJoin = jest.fn().mockReturnValue({ select });
      const selectFrom = jest.fn().mockReturnValue({ innerJoin });
      return {
        selectFrom,
        innerJoin,
        select,
        selectRondaActual,
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

  describe("buildRecomputeAcordadoQuery", () => {
    function compile(casoId: string) {
      return buildRecomputeAcordadoQuery(
        createCompileOnlyKysely(),
        casoId,
      ).compile();
    }

    it("only ever moves a caso out of en_negociacion, and only into acordado", () => {
      const compiled = compile("caso-1");

      expect(compiled.sql).toMatch(/^update "casos" set "estado" = \$\d/i);
      expect(compiled.sql).toMatch(/"id"\s*=\s*\$\d/i);
      expect(compiled.sql).toMatch(/"estado"\s*=\s*\$\d/i);
      expect(compiled.parameters).toContain("acordado");
      expect(compiled.parameters).toContain("en_negociacion");
      expect(compiled.parameters).toContain("caso-1");
    });

    it("requires the caso to have at least one negociacion, so an empty caso never reads as fully signed", () => {
      const compiled = compile("caso-1");

      expect(compiled.sql).toMatch(
        /exists\s*\(\s*select\s+"negociaciones"\."id"\s+from\s+"negociaciones"/i,
      );
    });

    it("requires every negociacion to have an acuerdo both in force and firmado", () => {
      const compiled = compile("caso-1");

      // "no negociacion lacks a signed agreement in force" — the double
      // negation is what makes it "all of them" instead of "any of them".
      expect(compiled.sql).toMatch(/not exists/i);
      expect(compiled.sql).toMatch(/"acuerdos"\."vigente"\s*=\s*\$\d/i);
      expect(compiled.sql).toMatch(/"acuerdos"\."estado"\s*=\s*\$\d/i);
      expect(compiled.parameters).toContain(true);
      expect(compiled.parameters).toContain("firmado");
      expect(compiled.sql.match(/not exists/gi)).toHaveLength(2);
    });

    it("never writes ronda_actual, which no longer lives on casos", () => {
      expect(compile("caso-1").sql).not.toContain("ronda_actual");
    });
  });

  describe("recomputeAcordado", () => {
    function createFakeDb(execute: jest.Mock) {
      const returning = jest.fn().mockReturnValue({ execute });
      const where3 = jest.fn().mockReturnValue({ returning });
      const where2 = jest.fn().mockReturnValue({ where: where3 });
      const where1 = jest.fn().mockReturnValue({ where: where2 });
      const set = jest.fn().mockReturnValue({ where: where1 });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where1, where2, where3, returning, execute };
    }

    it("guards the update on the caso and on en_negociacion, and defers the all-materias test to a predicate", async () => {
      const execute = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const fakeDb = createFakeDb(execute);
      const repository = new CasosRepository({} as never);

      await repository.recomputeAcordado("caso-1", fakeDb as never);

      expect(fakeDb.updateTable).toHaveBeenCalledWith("casos");
      expect(fakeDb.set).toHaveBeenCalledWith({ estado: "acordado" });
      expect(fakeDb.where1).toHaveBeenCalledWith("id", "=", "caso-1");
      expect(fakeDb.where2).toHaveBeenCalledWith(
        "estado",
        "=",
        "en_negociacion",
      );
      // The two NOT EXISTS live inside this callback; a fake chain never runs
      // it, so what it actually filters is proven in the DB-gated integration
      // spec, not here.
      expect(fakeDb.where3).toHaveBeenCalledWith(expect.any(Function));
      const updatedValues = fakeDb.set.mock.calls[0][0];
      expect(updatedValues).not.toHaveProperty("ronda_actual");
    });

    it("resolves without throwing when no row matches: most signatures leave other materias open", async () => {
      const execute = jest.fn().mockResolvedValue([]);
      const fakeDb = createFakeDb(execute);
      const repository = new CasosRepository({} as never);

      await expect(
        repository.recomputeAcordado("caso-1", fakeDb as never),
      ).resolves.toBeUndefined();
    });

    it("maps a trigger-raised exception to a uniform 409 via the shared pg-error guard", async () => {
      const execute = jest.fn().mockRejectedValue({
        code: "P0001",
        message: "invalid caso estado transition",
      });
      const fakeDb = createFakeDb(execute);
      const repository = new CasosRepository({} as never);

      let thrown: unknown;
      try {
        await repository.recomputeAcordado("caso-1", fakeDb as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ConflictError);
      expect((thrown as ConflictError).getStatus()).toBe(HttpStatus.CONFLICT);
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

  describe("updateEstado", () => {
    function createFakeUpdateKysely(returnedRow: unknown) {
      const executeTakeFirstOrThrow = jest.fn().mockResolvedValue(returnedRow);
      const returning = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
      const where = jest.fn().mockReturnValue({ returning });
      const set = jest.fn().mockReturnValue({ where });
      const updateTable = jest.fn().mockReturnValue({ set });
      return { updateTable, set, where, returning, executeTakeFirstOrThrow };
    }

    it("sets casos.estado and returns the updated row, never touching plazo", async () => {
      const returnedRow = { id: "caso-1", estado: "terminado" };
      const fakeKysely = createFakeUpdateKysely(returnedRow);
      const repository = new CasosRepository(fakeKysely as never);

      const result = await repository.updateEstado("caso-1", "terminado");

      expect(fakeKysely.updateTable).toHaveBeenCalledWith("casos");
      expect(fakeKysely.set).toHaveBeenCalledWith({ estado: "terminado" });
      expect(fakeKysely.set.mock.calls[0][0]).not.toHaveProperty("plazo");
      expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "caso-1");
      expect(fakeKysely.returning).toHaveBeenCalledWith(["id", "estado"]);
      expect(result).toBe(returnedRow);
    });

    it("maps the state-machine trigger rejection to a conflict", async () => {
      const fakeKysely = createFakeUpdateKysely(undefined);
      fakeKysely.executeTakeFirstOrThrow.mockRejectedValue({
        code: "P0001",
        message: "Transición de estado inválida: acordado → terminado",
      });
      const repository = new CasosRepository(fakeKysely as never);

      await expect(
        repository.updateEstado("caso-1", "terminado"),
      ).rejects.toMatchObject({ status: 409, response: { code: "conflict" } });
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
    function createFakeSubqueryChain() {
      const chain: {
        selectFrom: jest.Mock;
        select: jest.Mock;
        whereRef: jest.Mock;
        where: jest.Mock;
      } = {
        selectFrom: jest.fn(),
        select: jest.fn(),
        whereRef: jest.fn(),
        where: jest.fn(),
      };
      chain.selectFrom.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      chain.whereRef.mockReturnValue(chain);
      chain.where.mockImplementation((...args: unknown[]) => {
        if (typeof args[0] === "function") {
          (args[0] as (eb: unknown) => unknown)(fakeExpressionBuilder);
        }
        return chain;
      });
      const fakeExpressionBuilder = {
        selectFrom: jest.fn().mockReturnValue(chain),
        exists: jest.fn((subquery: unknown) => ({ subquery, kind: "exists" })),
        not: jest.fn((expression: unknown) => ({ expression, kind: "not" })),
      };
      return { chain, fakeExpressionBuilder };
    }

    function createFakeSelectKysely(rows: unknown) {
      const wherePredicates: unknown[][] = [];
      const chain: {
        selectFrom: jest.Mock;
        select: jest.Mock;
        where: jest.Mock;
        orderBy: jest.Mock;
        limit: jest.Mock;
        execute: jest.Mock;
      } = {
        selectFrom: jest.fn(),
        select: jest.fn(),
        where: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        execute: jest.fn(),
      };
      chain.selectFrom.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      chain.where.mockImplementation((...args: unknown[]) => {
        wherePredicates.push(args);
        return chain;
      });
      chain.orderBy.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.execute.mockResolvedValue(rows);
      return { ...chain, wherePredicates };
    }

    it("returns casos whose plazo has passed, ordered deterministically by plazo", async () => {
      const rows = [{ id: "caso-1" }];
      const fakeKysely = createFakeSelectKysely(rows);
      const repository = new CasosRepository(fakeKysely as never);
      const now = new Date("2026-07-24T12:00:00.000Z");

      const result = await repository.findOverdueCasos(now);

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("casos");
      expect(fakeKysely.wherePredicates).toContainEqual([
        "plazo",
        "is not",
        null,
      ]);
      expect(fakeKysely.wherePredicates).toContainEqual([
        "plazo",
        "<=",
        now.toISOString(),
      ]);
      expect(fakeKysely.wherePredicates).toContainEqual([
        "estado",
        "in",
        ["nuevo", "activo", "en_negociacion"],
      ]);
      expect(fakeKysely.orderBy).toHaveBeenCalledWith("plazo", "asc");
      expect(result).toBe(rows);
    });

    it("bounds the per-tick workload to sweepBatchSize", async () => {
      const fakeKysely = createFakeSelectKysely([]);
      const repository = new CasosRepository(fakeKysely as never);

      await repository.findOverdueCasos(new Date("2026-07-24T12:00:00.000Z"));

      expect(fakeKysely.limit).toHaveBeenCalledWith(25);
    });

    it("scopes the scan to casos with an accepted party lacking a terminal vencimiento notification", async () => {
      const fakeKysely = createFakeSelectKysely([]);
      const repository = new CasosRepository(fakeKysely as never);

      await repository.findOverdueCasos(new Date("2026-07-24T12:00:00.000Z"));

      const existsPredicate = fakeKysely.wherePredicates.find(
        ([argument]) => typeof argument === "function",
      );
      expect(existsPredicate).toBeDefined();
      if (existsPredicate === undefined) {
        throw new Error("expected an exists predicate in the where chain");
      }

      const { chain: parteChain, fakeExpressionBuilder } =
        createFakeSubqueryChain();
      (existsPredicate[0] as (eb: unknown) => unknown)(fakeExpressionBuilder);

      expect(fakeExpressionBuilder.selectFrom).toHaveBeenCalledWith(
        "caso_partes as cp",
      );
      expect(fakeExpressionBuilder.exists).toHaveBeenCalledTimes(2);
      expect(parteChain.whereRef).toHaveBeenCalledWith(
        "cp.caso_id",
        "=",
        "casos.id",
      );
      expect(parteChain.where).toHaveBeenCalledWith(
        "cp.estado_invitacion",
        "=",
        estadoInvitacionAceptada,
      );

      expect(fakeExpressionBuilder.not).toHaveBeenCalledTimes(1);
      expect(fakeExpressionBuilder.selectFrom).toHaveBeenCalledWith(
        "notificaciones as n",
      );
      expect(parteChain.whereRef).toHaveBeenCalledWith(
        "n.caso_id",
        "=",
        "casos.id",
      );
      expect(parteChain.whereRef).toHaveBeenCalledWith(
        "n.usuario_id",
        "=",
        "cp.usuario_id",
      );
      expect(parteChain.where).toHaveBeenCalledWith(
        "n.evento",
        "=",
        "vencimiento",
      );
      expect(parteChain.where).toHaveBeenCalledWith("n.estado", "in", [
        "enviada",
        "fallida",
      ]);
    });
  });
});
