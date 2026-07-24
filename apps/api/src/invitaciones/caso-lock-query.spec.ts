import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { buildCasoLockQuery } from "./caso-lock-query";

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

describe("buildCasoLockQuery", () => {
  it("compiles to valid SQL with a non-empty column list and a row lock", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildCasoLockQuery(db, "caso-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"casos"/i);
    expect(compiled.sql.toLowerCase()).toContain("for update");
  });
});
