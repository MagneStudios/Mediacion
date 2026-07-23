import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { ConflictError } from "../common/errors/domain-errors";
import { propuestaViewColumns } from "./negociacion.types";
import {
  buildCreatePendingQuery,
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

  it("buildPatchGeneratedQuery updates propuestas scoped by id and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildPatchGeneratedQuery(
      db,
      "propuesta-1",
      { meetingPoint: [], narrative: "texto" },
      null,
    ).compile();

    expect(compiled.sql).toMatch(/^update "propuestas"/i);
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expectReturnsOnlyAllowlistedColumns(compiled.sql);
  });

  it("buildMarkEstadoQuery updates only estado, scoped by id, and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildMarkEstadoQuery(
      db,
      "propuesta-1",
      "aceptada",
    ).compile();

    expect(compiled.sql).toMatch(/^update "propuestas"/i);
    const setClause = compiled.sql.split(/where/i)[0];
    expect(setClause).toContain('"estado"');
    expect(setClause).not.toContain('"caso_id"');
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

describe("PropuestasRepository", () => {
  it("createPending returns the persisted allowlisted view", async () => {
    const view = { id: "prop-1", caso_id: "caso-1" };
    const fake = createFakeKysely();
    fake.executeTakeFirstOrThrow.mockResolvedValue(view);
    const repository = new PropuestasRepository(fake.kysely as never);

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
    const repository = new PropuestasRepository(fake.kysely as never);

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
    const repository = new PropuestasRepository(fake.kysely as never);

    const result = await repository.patchGenerated(
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
    const repository = new PropuestasRepository(fake.kysely as never);

    await expect(
      repository.markEstado("prop-1", "aceptada"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("findForCase returns every allowlisted view row for the case", async () => {
    const rows = [{ id: "prop-1" }, { id: "prop-2" }];
    const fake = createFakeKysely();
    fake.execute.mockResolvedValue(rows);
    const repository = new PropuestasRepository(fake.kysely as never);

    const result = await repository.findForCase("caso-1");

    expect(result).toBe(rows);
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
    const repository = new PropuestasRepository(fake.kysely as never);

    const result = await repository.readBothPartyPositionsForEngine("caso-9");

    expect(fake.selectFrom).toHaveBeenCalledWith("items");
    expect(fake.where).toHaveBeenCalledWith("caso_id", "=", "caso-9");
    expect(result).toBe(bothParties);
  });
});
