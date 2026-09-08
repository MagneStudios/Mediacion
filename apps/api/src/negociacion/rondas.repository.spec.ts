import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { ConflictError } from "../common/errors/domain-errors";
import {
  buildActiveNegociacionQuery,
  buildFindByNumeroQuery,
  buildInsertNextRondaQuery,
  RondasRepository,
} from "./rondas.repository";

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

describe("buildInsertNextRondaQuery", () => {
  it("inserts into rondas with the negociacion_id, never touching casos.ronda_actual directly", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildInsertNextRondaQuery(
      db,
      "caso-1",
      "negociacion-1",
      2,
    ).compile();

    expect(compiled.sql).toMatch(/^insert into "rondas"/i);
    expect(compiled.sql.toLowerCase()).not.toContain('"casos"');
    expect(compiled.sql).not.toContain('"ronda_actual"');
    expect(compiled.parameters).toEqual(["caso-1", "negociacion-1", 2]);
  });
});

describe("buildActiveNegociacionQuery", () => {
  it("reads the legacy negociacion (materia is null) scoped by caso id, read-only", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildActiveNegociacionQuery(db, "caso-1").compile();

    expect(compiled.sql).toMatch(
      /^select\s+"id",\s*"round"\s+from\s+"negociaciones"/i,
    );
    expect(compiled.sql).toMatch(/where\s+.*"caso_id"\s*=\s*\$\d/i);
    expect(compiled.sql).toMatch(/"materia"\s+is\s+null/i);
    expect(compiled.parameters).toEqual(["caso-1"]);
  });
});

describe("buildFindByNumeroQuery", () => {
  it("reads a ronda by caso id and numero, read-only", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindByNumeroQuery(db, "caso-1", 1).compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"rondas"/i);
    expect(compiled.sql).toMatch(/where\s+.*"caso_id"\s*=\s*\$\d/i);
    expect(compiled.sql).toMatch(/where\s+.*"numero"\s*=\s*\$\d/i);
    expect(compiled.parameters).toEqual(["caso-1", 1]);
  });
});

function createFakeKysely() {
  const executeTakeFirstOrThrow = jest.fn();
  const executeTakeFirst = jest.fn();
  const builder: Record<string, jest.Mock> = {
    executeTakeFirstOrThrow,
    executeTakeFirst,
  };
  const returnBuilder = jest.fn(() => builder);
  builder.values = returnBuilder;
  builder.returningAll = returnBuilder;
  builder.select = returnBuilder;
  builder.selectAll = returnBuilder;
  builder.where = returnBuilder;
  const kysely = {
    insertInto: jest.fn(() => builder),
    selectFrom: jest.fn(() => builder),
  };
  return { kysely, executeTakeFirstOrThrow, executeTakeFirst };
}

function createFakeTrxKysely() {
  const executeTakeFirstOrThrow = jest.fn();
  const execute = jest.fn();
  const builder: Record<string, jest.Mock> = {
    executeTakeFirstOrThrow,
    execute,
  };
  const returnBuilder = jest.fn(() => builder);
  builder.values = returnBuilder;
  builder.set = returnBuilder;
  builder.returningAll = returnBuilder;
  builder.where = returnBuilder;
  const trx = {
    insertInto: jest.fn(() => builder),
    updateTable: jest.fn(() => builder),
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
    execute,
  };
}

describe("RondasRepository", () => {
  it("insertNextRonda inserts the ronda and bumps negociaciones.round in the same transaction", async () => {
    const ronda = {
      id: "ronda-2",
      caso_id: "caso-1",
      negociacion_id: "negociacion-1",
      numero: 2,
    };
    const fake = createFakeTrxKysely();
    fake.executeTakeFirstOrThrow.mockResolvedValue(ronda);
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.insertNextRonda(
      "caso-1",
      "negociacion-1",
      2,
    );

    expect(result).toBe(ronda);
    expect(fake.insertInto).toHaveBeenCalledWith("rondas");
    expect(fake.values).toHaveBeenCalledWith({
      caso_id: "caso-1",
      negociacion_id: "negociacion-1",
      numero: 2,
    });
    expect(fake.updateTable).toHaveBeenCalledWith("negociaciones");
    expect(fake.values).toHaveBeenCalledWith({ round: 2 });
  });

  it("insertNextRonda maps a pg conflict into a domain ConflictError", async () => {
    const fake = createFakeTrxKysely();
    fake.executeTakeFirstOrThrow.mockRejectedValue({
      code: "23505",
      message: "duplicate ronda numero",
    });
    const repository = new RondasRepository(fake.kysely as never);

    await expect(
      repository.insertNextRonda("caso-1", "negociacion-1", 2),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("resolveActiveNegociacion returns the legacy negociacion of the matched case", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue({ id: "negociacion-1", round: 3 });
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.resolveActiveNegociacion("caso-1");

    expect(result).toEqual({ id: "negociacion-1", round: 3 });
  });

  it("resolveActiveNegociacion returns undefined when no case matches", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue(undefined);
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.resolveActiveNegociacion("missing");

    expect(result).toBeUndefined();
  });

  it("findByNumero returns the ronda matching caso id and numero", async () => {
    const ronda = { id: "ronda-1", caso_id: "caso-1", numero: 1 };
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue(ronda);
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.findByNumero("caso-1", 1);

    expect(result).toBe(ronda);
  });

  it("findByNumero returns undefined when no ronda matches", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue(undefined);
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.findByNumero("caso-1", 1);

    expect(result).toBeUndefined();
  });
});
