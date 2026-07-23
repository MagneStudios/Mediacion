import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  buildFindByPropuestaQuery,
  buildInsertRespuestaQuery,
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
