import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { propuestaViewColumns } from "./negociacion.types";
import {
  buildCreatePendingQuery,
  buildFindForCaseQuery,
  buildMarkEstadoQuery,
  buildPatchGeneratedQuery,
} from "./propuestas.repository";

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

function expectReturnsOnlyAllowlistedColumns(sql: string) {
  const returningClause = sql.split(/returning/i)[1];
  expect(returningClause).toBeDefined();
  for (const column of propuestaViewColumns) {
    expect(returningClause).toContain(`"${column}"`);
  }
}

describe("PropuestasRepository query builders", () => {
  it("buildCreatePendingQuery inserts into propuestas and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildCreatePendingQuery(
      db,
      "caso-1",
      "ronda-1",
      { meetingPoint: [], narrative: null },
      "openai/gpt-4",
    ).compile();

    expect(compiled.sql).toMatch(/^insert into "propuestas"/i);
    expectReturnsOnlyAllowlistedColumns(compiled.sql);
  });

  it("buildPatchGeneratedQuery updates propuestas scoped by id and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildPatchGeneratedQuery(
      db,
      "propuesta-1",
      { meetingPoint: [], narrative: "texto" },
      null,
    ).compile();

    expect(compiled.sql).toMatch(/^update "propuestas"/i);
    expect(compiled.sql).toMatch(/where\s+.*"id"\s*=\s*\$\d/i);
    expectReturnsOnlyAllowlistedColumns(compiled.sql);
  });

  it("buildMarkEstadoQuery updates only estado, scoped by id, and returns only the allowlisted view", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildMarkEstadoQuery(
      db,
      "propuesta-1",
      "aceptada",
    ).compile();

    expect(compiled.sql).toMatch(/^update "propuestas"/i);
    const setClause = compiled.sql.split(/where/i)[0];
    expect(setClause).toContain('"estado"');
    expect(setClause).not.toContain('"caso_id"');
    expectReturnsOnlyAllowlistedColumns(compiled.sql);
  });

  it("buildFindForCaseQuery selects only the allowlisted view scoped by caso_id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindForCaseQuery(db, "caso-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"propuestas"/i);
    for (const column of propuestaViewColumns) {
      expect(compiled.sql).toContain(`"${column}"`);
    }
    expect(compiled.parameters).toEqual(["caso-1"]);
  });
});
