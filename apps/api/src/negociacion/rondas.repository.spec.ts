import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { ConflictError } from "../common/errors/domain-errors";
import {
  buildCurrentRondaActualQuery,
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
  it("inserts only into rondas, never touching casos.ronda_actual directly", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildInsertNextRondaQuery(db, "caso-1", 2).compile();

    expect(compiled.sql).toMatch(/^insert into "rondas"/i);
    expect(compiled.sql.toLowerCase()).not.toContain("casos");
    expect(compiled.sql).not.toContain('"ronda_actual"');
    expect(compiled.parameters).toEqual(["caso-1", 2]);
  });
});

describe("buildCurrentRondaActualQuery", () => {
  it("reads casos.ronda_actual scoped by caso id, read-only", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildCurrentRondaActualQuery(db, "caso-1").compile();

    expect(compiled.sql).toMatch(/^select\s+"ronda_actual"\s+from\s+"casos"/i);
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expect(compiled.parameters).toEqual(["caso-1"]);
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
  builder.where = returnBuilder;
  const kysely = {
    insertInto: jest.fn(() => builder),
    selectFrom: jest.fn(() => builder),
  };
  return { kysely, executeTakeFirstOrThrow, executeTakeFirst };
}

describe("RondasRepository", () => {
  it("insertNextRonda returns the inserted ronda", async () => {
    const ronda = { id: "ronda-2", caso_id: "caso-1", numero: 2 };
    const fake = createFakeKysely();
    fake.executeTakeFirstOrThrow.mockResolvedValue(ronda);
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.insertNextRonda("caso-1", 2);

    expect(result).toBe(ronda);
  });

  it("insertNextRonda maps a pg conflict into a domain ConflictError", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirstOrThrow.mockRejectedValue({
      code: "23505",
      message: "duplicate ronda numero",
    });
    const repository = new RondasRepository(fake.kysely as never);

    await expect(
      repository.insertNextRonda("caso-1", 2),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("currentRondaActual returns the ronda_actual of the matched case", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue({ ronda_actual: 3 });
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.currentRondaActual("caso-1");

    expect(result).toBe(3);
  });

  it("currentRondaActual returns undefined when no case matches", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirst.mockResolvedValue(undefined);
    const repository = new RondasRepository(fake.kysely as never);

    const result = await repository.currentRondaActual("missing");

    expect(result).toBeUndefined();
  });
});
