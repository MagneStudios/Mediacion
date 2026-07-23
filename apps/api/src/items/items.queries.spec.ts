import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  buildFindOwnByIdQuery,
  buildFindOwnQuery,
  buildUpdateOwnQuery,
} from "./items.queries";
import type { UpdateItemDto } from "./items.types";

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

describe("items query builders", () => {
  const parteIdWherePredicate = /where\s+.*"parte_id"\s*=\s*\$\d/i;

  it("buildFindOwnQuery compiles a SELECT scoped by caso_id and parte_id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindOwnQuery(db, "caso-1", "user-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"items"/i);
    expect(compiled.sql).toContain('"caso_id"');
    expect(compiled.sql).toMatch(parteIdWherePredicate);
    expect(compiled.parameters).toEqual(["caso-1", "user-1"]);
  });

  it("buildFindOwnByIdQuery compiles a SELECT scoped by id and parte_id", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildFindOwnByIdQuery(db, "item-1", "user-1").compile();

    expect(compiled.sql).toMatch(/^select\s+\S+.*from\s+"items"/i);
    expect(compiled.sql).toContain('"id"');
    expect(compiled.sql).toMatch(parteIdWherePredicate);
    expect(compiled.parameters).toEqual(["item-1", "user-1"]);
  });

  it("buildUpdateOwnQuery compiles an UPDATE scoped by id and parte_id with RETURNING", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildUpdateOwnQuery(db, "item-1", "user-1", {
      nombre: "Bicicleta",
    }).compile();

    expect(compiled.sql).toMatch(/^update\s+"items"/i);
    expect(compiled.sql).toMatch(parteIdWherePredicate);
    expect(compiled.sql.toLowerCase()).toContain("returning");
    expect(compiled.parameters).toEqual(["Bicicleta", "item-1", "user-1"]);
  });

  it("buildUpdateOwnQuery never lets a malicious patch SET parte_id or caso_id — mass-assignment defense", () => {
    const db = createCompileOnlyKysely();
    const maliciousPatch = {
      nombre: "Bicicleta",
      parte_id: "user-b",
      caso_id: "other-case",
    } as unknown as UpdateItemDto;

    const compiled = buildUpdateOwnQuery(
      db,
      "item-1",
      "user-1",
      maliciousPatch,
    ).compile();
    const setClause = compiled.sql.split(/where/i)[0];

    expect(setClause).not.toMatch(/"parte_id"/i);
    expect(setClause).not.toMatch(/"caso_id"/i);
    expect(compiled.parameters).not.toContain("user-b");
    expect(compiled.parameters).not.toContain("other-case");
  });
});
