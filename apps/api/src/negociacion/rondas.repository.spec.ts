import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  buildCurrentRondaActualQuery,
  buildInsertNextRondaQuery,
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
