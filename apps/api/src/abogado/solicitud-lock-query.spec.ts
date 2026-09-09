import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { buildCasoLockQuery } from "./solicitud-lock-query";

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
  it("takes a row lock on the caso, so two concurrent solicitudes serialise", () => {
    const compiled = buildCasoLockQuery(
      createCompileOnlyKysely(),
      "caso-1",
    ).compile();

    expect(compiled.sql).toMatch(/^select "id" from "casos"/i);
    expect(compiled.sql).toMatch(/where "id" = \$1 for update$/i);
    expect(compiled.parameters).toEqual(["caso-1"]);
  });
});
