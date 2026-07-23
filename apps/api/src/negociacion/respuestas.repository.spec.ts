import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { ConflictError } from "../common/errors/domain-errors";
import {
  buildFindByPropuestaQuery,
  buildInsertRespuestaQuery,
  RespuestasRepository,
} from "./respuestas.repository";

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

describe("buildInsertRespuestaQuery", () => {
  it("inserts one decision into respuestas_propuesta scoped by propuesta and parte", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildInsertRespuestaQuery(
      db,
      "propuesta-1",
      "user-a",
      "acepta",
    ).compile();

    expect(compiled.sql).toMatch(/^insert into "respuestas_propuesta"/i);
    expect(compiled.parameters).toEqual(["propuesta-1", "user-a", "acepta"]);
  });
});

describe("buildFindByPropuestaQuery", () => {
  it("selects respuestas_propuesta rows scoped by propuesta_id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindByPropuestaQuery(db, "propuesta-1").compile();

    expect(compiled.sql).toMatch(
      /^select\s+\S+.*from\s+"respuestas_propuesta"/i,
    );
    expect(compiled.sql).toMatch(/where\s+.*"propuesta_id"\s*=\s*\$\d/i);
    expect(compiled.parameters).toEqual(["propuesta-1"]);
  });
});

function createFakeKysely() {
  const executeTakeFirstOrThrow = jest.fn();
  const execute = jest.fn();
  const builder: Record<string, jest.Mock> = {
    executeTakeFirstOrThrow,
    execute,
  };
  const returnBuilder = jest.fn(() => builder);
  builder.values = returnBuilder;
  builder.returningAll = returnBuilder;
  builder.selectAll = returnBuilder;
  builder.where = returnBuilder;
  const kysely = {
    insertInto: jest.fn(() => builder),
    selectFrom: jest.fn(() => builder),
  };
  return { kysely, executeTakeFirstOrThrow, execute };
}

describe("RespuestasRepository", () => {
  it("insert returns the persisted respuesta", async () => {
    const respuesta = {
      id: "resp-1",
      propuesta_id: "propuesta-1",
      parte_id: "user-a",
      decision: "acepta",
    };
    const fake = createFakeKysely();
    fake.executeTakeFirstOrThrow.mockResolvedValue(respuesta);
    const repository = new RespuestasRepository(fake.kysely as never);

    const result = await repository.insert("propuesta-1", "user-a", "acepta");

    expect(result).toBe(respuesta);
  });

  it("insert maps a pg unique violation into a domain ConflictError", async () => {
    const fake = createFakeKysely();
    fake.executeTakeFirstOrThrow.mockRejectedValue({
      code: "23505",
      message: "one decision per parte",
    });
    const repository = new RespuestasRepository(fake.kysely as never);

    await expect(
      repository.insert("propuesta-1", "user-a", "acepta"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("findByPropuesta returns every respuesta row for the propuesta", async () => {
    const rows = [{ id: "resp-1" }, { id: "resp-2" }];
    const fake = createFakeKysely();
    fake.execute.mockResolvedValue(rows);
    const repository = new RespuestasRepository(fake.kysely as never);

    const result = await repository.findByPropuesta("propuesta-1");

    expect(result).toBe(rows);
  });
});
