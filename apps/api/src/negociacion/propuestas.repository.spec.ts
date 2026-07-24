import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { CasosRepository } from "../casos/casos.repository";
import { ConflictError } from "../common/errors/domain-errors";
import { propuestaViewColumns } from "./negociacion.types";
import {
  buildCreatePendingQuery,
  buildExistsForRondaQuery,
  buildFindByIdQuery,
  buildFindCasoIdQuery,
  buildFindForCaseQuery,
  buildMarkEstadoQuery,
  buildPatchGeneratedQuery,
  PropuestasRepository,
} from "./propuestas.repository";

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

function expectReturnsOnlyAllowlistedColumns(sql: string) {
  const returningClause = sql.split(/returning/i)[1];
  expect(returningClause).toBeDefined();
  for (const column of propuestaViewColumns) {
    expect(returningClause).toContain(`"${column}"`);
  }
}

describe("PropuestasRepository query builders", () => {
  it("buildCreatePendingQuery inserts into propuestas and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildCreatePendingQuery(
      db,
      "caso-1",
      "ronda-1",
      { meetingPoint: [], narrative: null },
      "openai/gpt-4",
    ).compile();

    expect(compiled.sql).toMatch(/^insert into "propuestas"/i);
    expectReturnsOnlyAllowlistedColumns(compiled.sql);
  });

  it("buildPatchGeneratedQuery updates propuestas scoped by caso_id and id and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildPatchGeneratedQuery(
      db,
      "caso-1",
      "propuesta-1",
      { meetingPoint: [], narrative: "texto" },
      null,
    ).compile();

    expect(compiled.sql).toMatch(/^update "propuestas"/i);
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expect(compiled.sql).toMatch(/where\s+.*"caso_id"\s*=\s*\$\d/i);
    expectReturnsOnlyAllowlistedColumns(compiled.sql);
  });

  it("buildMarkEstadoQuery updates only estado, scoped by caso_id and id, and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildMarkEstadoQuery(
      db,
      "caso-1",
      "propuesta-1",
      "aceptada",
    ).compile();

    expect(compiled.sql).toMatch(/^update "propuestas"/i);
    const setClause = compiled.sql.split(/where/i)[0];
    expect(setClause).toContain('"estado"');
    expect(setClause).not.toContain('"caso_id"');
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expect(compiled.sql).toMatch(/where\s+.*"caso_id"\s*=\s*\$\d/i);
    expectReturnsOnlyAllowlistedColumns(compiled.sql);
  });

  it("buildFindForCaseQuery selects only the allowlisted view scoped by caso_id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindForCaseQuery(db, "caso-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"propuestas"/i);
    for (const column of propuestaViewColumns) {
      expect(compiled.sql).toContain(`"${column}"`);
    }
    expect(compiled.parameters).toEqual(["caso-1"]);
  });

  it("buildExistsForRondaQuery selects a single row scoped by caso_id and ronda_id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildExistsForRondaQuery(
      db,
      "caso-1",
      "ronda-1",
    ).compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"propuestas"/i);
    expect(compiled.sql).toMatch(/where\s+.*"caso_id"\s*=\s*\$\d/i);
    expect(compiled.sql).toMatch(/where\s+.*"ronda_id"\s*=\s*\$\d/i);
    expect(compiled.sql).toMatch(/limit/i);
    expect(compiled.parameters).toEqual(["caso-1", "ronda-1", 1]);
  });

  it("buildFindCasoIdQuery selects only caso_id scoped by propuesta id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindCasoIdQuery(db, "propuesta-1").compile();

    expect(compiled.sql).toMatch(/^select\s+"caso_id"\s+from\s+"propuestas"/i);
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expect(compiled.parameters).toEqual(["propuesta-1"]);
  });

  it("buildFindByIdQuery selects only the allowlisted view scoped by id and caso_id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindByIdQuery(db, "caso-1", "propuesta-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"propuestas"/i);
    for (const column of propuestaViewColumns) {
      expect(compiled.sql).toContain(`"${column}"`);
    }
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expect(compiled.sql).toMatch(/where\s+.*"caso_id"\s*=\s*\$\d/i);
    expect(compiled.parameters).toEqual(["propuesta-1", "caso-1"]);
  });
});

function createFakeKysely() {
  const executeTakeFirstOrThrow = jest.fn();
  const executeTakeFirst = jest.fn();
  const execute = jest.fn();
  const builder: Record<string, jest.Mock> = {
    executeTakeFirstOrThrow,
    executeTakeFirst,
    execute,
  };
  const returnBuilder = jest.fn(() => builder);
  builder.values = returnBuilder;
  builder.set = returnBuilder;
  builder.where = returnBuilder;
  builder.select = returnBuilder;
  builder.returning = returnBuilder;
  builder.limit = returnBuilder;
  const kysely = {
    insertInto: jest.fn(() => builder),
    updateTable: jest.fn(() => builder),
    selectFrom: jest.fn(() => builder),
  };
  return {
    kysely,
    ...kysely,
    where: builder.where,
    executeTakeFirstOrThrow,
    executeTakeFirst,
    execute,
  };
}

function createRepository(
  kysely: unknown,
  casosRepository: unknown = {},
): PropuestasRepository {
  return new PropuestasRepository(
    kysely as never,
    casosRepository as CasosRepository,
  );
}

describe("PropuestasRepository", () => {
  it("createPending returns the persisted allowlisted view", async () => {
    const view = { id: "prop-1", caso_id: "caso-1" };
    const fake = createFakeKysely();
    fake.executeTakeFirstOrThrow.mockResolvedValue(view);
    const repository = createRepository(fake.kysely);

    const result = await repository.createPending(
      "caso-1",
      "ronda-1",
      { meetingPoint: [], narrative: null },
      "openai/gpt-4",
    );

    expect(result).toBe(view);
  });

  it("createPending maps a pg conflict into a domain ConflictError", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirstOrThrow.mockRejectedValue({
      code: "23505",
      message: "duplicate key",
    });
    const repository = createRepository(fake.kysely);

    await expect(
      repository.createPending(
        "caso-1",
        "ronda-1",
        { meetingPoint: [], narrative: null },
        "openai/gpt-4",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("patchGenerated returns undefined when no propuesta matches", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue(undefined);
    const repository = createRepository(fake.kysely);

    const result = await repository.patchGenerated(
      "caso-1",
      "missing",
      { meetingPoint: [], narrative: "texto" },
      null,
    );

    expect(result).toBeUndefined();
  });

  it("markEstado maps a pg conflict into a domain ConflictError", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockRejectedValue({
      code: "P0001",
      message: "estado transition rejected",
    });
    const repository = createRepository(fake.kysely);

    await expect(
      repository.markEstado("caso-1", "prop-1", "aceptada"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("findForCase returns every allowlisted view row for the case", async () => {
    const rows = [{ id: "prop-1" }, { id: "prop-2" }];
    const fake = createFakeKysely();
    fake.execute.mockResolvedValue(rows);
    const repository = createRepository(fake.kysely);

    const result = await repository.findForCase("caso-1");

    expect(result).toBe(rows);
  });

  it("existsForRonda returns true when a propuesta already exists for the ronda", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue({ id: "prop-1" });
    const repository = createRepository(fake.kysely);

    const result = await repository.existsForRonda("caso-1", "ronda-1");

    expect(result).toBe(true);
  });

  it("existsForRonda returns false when no propuesta exists for the ronda", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue(undefined);
    const repository = createRepository(fake.kysely);

    const result = await repository.existsForRonda("caso-1", "ronda-1");

    expect(result).toBe(false);
  });

  it("readBothPartyPositionsForEngine reads both parties' items scoped by caso", async () => {
    const bothParties = [
      {
        parte_id: "parte-a",
        categoria: "economico",
        nombre: "monto",
        valor_min: 100,
        valor_max: 200,
      },
      {
        parte_id: "parte-b",
        categoria: "economico",
        nombre: "monto",
        valor_min: 150,
        valor_max: 300,
      },
    ];
    const fake = createFakeKysely();
    fake.execute.mockResolvedValue(bothParties);
    const repository = createRepository(fake.kysely);

    const result = await repository.readBothPartyPositionsForEngine("caso-9");

    expect(fake.selectFrom).toHaveBeenCalledWith("items");
    expect(fake.where).toHaveBeenCalledWith("caso_id", "=", "caso-9");
    expect(result).toBe(bothParties);
  });

  it("findCasoId returns the caso_id for an existing propuesta", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue({ caso_id: "caso-1" });
    const repository = createRepository(fake.kysely);

    const result = await repository.findCasoId("prop-1");

    expect(result).toBe("caso-1");
  });

  it("findCasoId returns undefined when the propuesta does not exist", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue(undefined);
    const repository = createRepository(fake.kysely);

    const result = await repository.findCasoId("missing");

    expect(result).toBeUndefined();
  });
});

function createFakeTrxKysely() {
  const executeTakeFirstOrThrow = jest.fn();
  const executeTakeFirst = jest.fn();
  const execute = jest.fn();
  const builder: Record<string, jest.Mock> = {
    executeTakeFirstOrThrow,
    executeTakeFirst,
    execute,
  };
  const returnBuilder = jest.fn(() => builder);
  builder.values = returnBuilder;
  builder.set = returnBuilder;
  builder.where = returnBuilder;
  builder.select = returnBuilder;
  builder.selectAll = returnBuilder;
  builder.returning = returnBuilder;
  builder.returningAll = returnBuilder;
  builder.forUpdate = returnBuilder;
  builder.limit = returnBuilder;
  const trx = {
    insertInto: jest.fn(() => builder),
    updateTable: jest.fn(() => builder),
    selectFrom: jest.fn(() => builder),
  };
  const transactionExecute = jest.fn((callback: (trx: unknown) => unknown) =>
    callback(trx),
  );
  const kysely = {
    transaction: jest.fn(() => ({ execute: transactionExecute })),
  };
  return {
    kysely,
    trx,
    ...trx,
    values: builder.values,
    executeTakeFirstOrThrow,
    executeTakeFirst,
    execute,
  };
}

describe("PropuestasRepository.resolveRespuesta", () => {
  const pendienteView = {
    id: "prop-1",
    caso_id: "caso-1",
    ronda_id: "ronda-1",
    contenido: { meetingPoint: [], narrative: "texto" },
    fundamentacion: null,
    estado: "pendiente",
    modelo_ia: "openai/gpt-4",
    fecha: "now",
  };

  it("marks the propuesta aceptada and the caso acordado once both partes accept", async () => {
    const aceptadaView = { ...pendienteView, estado: "aceptada" };
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow
      .mockResolvedValueOnce(pendienteView)
      .mockResolvedValueOnce({ id: "resp-1" })
      .mockResolvedValueOnce(aceptadaView);
    fake.execute.mockResolvedValueOnce([
      { decision: "acepta" },
      { decision: "acepta" },
    ]);
    const markAcordado = jest.fn().mockResolvedValue(undefined);
    const casosRepository = { markAcordado } as unknown as CasosRepository;
    const repository = createRepository(fake.kysely, casosRepository);

    const result = await repository.resolveRespuesta(
      "caso-1",
      "prop-1",
      "user-b",
      "acepta",
    );

    expect(result).toBe(aceptadaView);
    expect(markAcordado).toHaveBeenCalledWith("caso-1", fake.trx);
  });

  it("keeps the propuesta pendiente when only one parte has accepted so far", async () => {
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow
      .mockResolvedValueOnce(pendienteView)
      .mockResolvedValueOnce({ id: "resp-1" });
    fake.execute.mockResolvedValueOnce([{ decision: "acepta" }]);
    const markAcordado = jest.fn();
    const casosRepository = { markAcordado } as unknown as CasosRepository;
    const repository = createRepository(fake.kysely, casosRepository);

    const result = await repository.resolveRespuesta(
      "caso-1",
      "prop-1",
      "user-a",
      "acepta",
    );

    expect(result).toBe(pendienteView);
    expect(markAcordado).not.toHaveBeenCalled();
  });

  it("marks the propuesta rechazada and opens the next ronda, never writing casos.ronda_actual directly", async () => {
    const rechazadaView = { ...pendienteView, estado: "rechazada" };
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow
      .mockResolvedValueOnce(pendienteView)
      .mockResolvedValueOnce({ id: "resp-1" })
      .mockResolvedValueOnce(rechazadaView)
      .mockResolvedValueOnce({ ronda_actual: 2 })
      .mockResolvedValueOnce({ id: "ronda-2", caso_id: "caso-1", numero: 3 });
    const markAcordado = jest.fn();
    const casosRepository = { markAcordado } as unknown as CasosRepository;
    const repository = createRepository(fake.kysely, casosRepository);

    const result = await repository.resolveRespuesta(
      "caso-1",
      "prop-1",
      "user-a",
      "rechaza",
    );

    expect(result).toBe(rechazadaView);
    expect(fake.insertInto).toHaveBeenCalledWith("rondas");
    expect(fake.values).toHaveBeenCalledWith({
      caso_id: "caso-1",
      numero: 3,
    });
    expect(markAcordado).not.toHaveBeenCalled();
  });

  it("maps a duplicate response into a domain ConflictError via the shared pg-error guard", async () => {
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow
      .mockResolvedValueOnce(pendienteView)
      .mockRejectedValueOnce({
        code: "23505",
        message: "one decision per parte",
      });
    const repository = createRepository(fake.kysely);

    await expect(
      repository.resolveRespuesta("caso-1", "prop-1", "user-a", "acepta"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects with 409 when the propuesta is no longer pendiente, inserting no response", async () => {
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow.mockResolvedValueOnce({
      ...pendienteView,
      estado: "aceptada",
    });
    const repository = createRepository(fake.kysely);

    let thrown: unknown;
    try {
      await repository.resolveRespuesta("caso-1", "prop-1", "user-a", "acepta");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "propuesta_not_pendiente",
    });
    expect(fake.insertInto).not.toHaveBeenCalled();
  });

  it("rejects with 404 when the propuesta cannot be locked, inserting no response", async () => {
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce(undefined);
    const repository = createRepository(fake.kysely);

    let thrown: unknown;
    try {
      await repository.resolveRespuesta(
        "caso-1",
        "missing",
        "user-a",
        "acepta",
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "propuesta_not_found",
    });
    expect(fake.executeTakeFirstOrThrow).not.toHaveBeenCalled();
    expect(fake.insertInto).not.toHaveBeenCalled();
  });

  it("rejects with 409 when the propuesta narrative is still null, inserting no response and changing no estado", async () => {
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow.mockResolvedValueOnce({
      ...pendienteView,
      contenido: { meetingPoint: [], narrative: null },
    });
    const repository = createRepository(fake.kysely);

    let thrown: unknown;
    try {
      await repository.resolveRespuesta("caso-1", "prop-1", "user-a", "acepta");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "propuesta_not_ready",
    });
    expect(fake.insertInto).not.toHaveBeenCalled();
    expect(fake.updateTable).not.toHaveBeenCalled();
  });

  it("flows normally to insert a response when the propuesta narrative is present", async () => {
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow
      .mockResolvedValueOnce(pendienteView)
      .mockResolvedValueOnce({ id: "resp-1" });
    fake.execute.mockResolvedValueOnce([{ decision: "acepta" }]);
    const markAcordado = jest.fn();
    const casosRepository = { markAcordado } as unknown as CasosRepository;
    const repository = createRepository(fake.kysely, casosRepository);

    const result = await repository.resolveRespuesta(
      "caso-1",
      "prop-1",
      "user-a",
      "acepta",
    );

    expect(result).toBe(pendienteView);
    expect(fake.insertInto).toHaveBeenCalledWith("respuestas_propuesta");
  });

  it("rejects the whole transaction when markAcordado throws, leaving the propuesta not aceptada", async () => {
    const aceptadaView = { ...pendienteView, estado: "aceptada" };
    const fake = createFakeTrxKysely();
    fake.executeTakeFirst.mockResolvedValueOnce({ id: "prop-1" });
    fake.executeTakeFirstOrThrow
      .mockResolvedValueOnce(pendienteView)
      .mockResolvedValueOnce({ id: "resp-1" })
      .mockResolvedValueOnce(aceptadaView);
    fake.execute.mockResolvedValueOnce([
      { decision: "acepta" },
      { decision: "acepta" },
    ]);
    const conflict = new ConflictError(
      "Caso caso-1 was not en_negociacion when marking acordado",
    );
    const markAcordado = jest.fn().mockRejectedValue(conflict);
    const casosRepository = { markAcordado } as unknown as CasosRepository;
    const repository = createRepository(fake.kysely, casosRepository);

    await expect(
      repository.resolveRespuesta("caso-1", "prop-1", "user-b", "acepta"),
    ).rejects.toBe(conflict);
  });
});
