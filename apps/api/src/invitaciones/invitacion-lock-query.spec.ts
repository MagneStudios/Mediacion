import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { buildInvitacionLockQuery } from "./invitacion-lock-query";

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

describe("buildInvitacionLockQuery", () => {
  it("compiles to valid SQL scoped by id and caso_id with a row lock", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildInvitacionLockQuery(db, "inv-1", "caso-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"invitaciones"/i);
    expect(compiled.sql.toLowerCase()).toContain('"id" = ');
    expect(compiled.sql.toLowerCase()).toContain('"caso_id" = ');
    expect(compiled.sql.toLowerCase()).toContain("for update");
    expect(compiled.parameters).toEqual(["inv-1", "caso-1"]);
  });
});
