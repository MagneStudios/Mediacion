import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { buildPropuestaLockQuery } from "./propuesta-lock-query";

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

describe("buildPropuestaLockQuery", () => {
  it("compiles to a row-locked SELECT scoped by propuesta id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildPropuestaLockQuery(db, "propuesta-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"propuestas"/i);
    expect(compiled.sql.toLowerCase()).toContain("for update");
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expect(compiled.parameters).toEqual(["propuesta-1"]);
  });
});
