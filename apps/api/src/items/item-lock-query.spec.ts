import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { buildItemLockQuery } from "./item-lock-query";

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

describe("buildItemLockQuery", () => {
  it("compiles to valid SQL with a non-empty column list, a row lock, and the parte_id predicate", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildItemLockQuery(db, "item-1", "user-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"items"/i);
    expect(compiled.sql.toLowerCase()).toContain("for update");
    expect(compiled.sql).toMatch(/where\s+.*"parte_id"\s*=\s*\$\d/i);
    expect(compiled.parameters).toEqual(["item-1", "user-1"]);
  });
});
