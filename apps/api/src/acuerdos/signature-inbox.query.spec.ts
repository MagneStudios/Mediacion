import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { buildSignatureInboxQuery } from "./firmas.repository";

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

describe("buildSignatureInboxQuery", () => {
  it("labels every row with the materia and version that tell two acuerdos of one caso apart", () => {
    const compiled = buildSignatureInboxQuery(
      createCompileOnlyKysely(),
      "user-a",
    ).compile();

    expect(compiled.sql).toContain(
      '"negociaciones"."materia" as "subject_type"',
    );
    expect(compiled.sql).toContain('"acuerdos"."version" as "version"');
  });

  it("joins the negociacion left, so an acuerdo without one still reaches the inbox", () => {
    const compiled = buildSignatureInboxQuery(
      createCompileOnlyKysely(),
      "user-a",
    ).compile();

    expect(compiled.sql).toMatch(
      /left join\s+"negociaciones"\s+on\s+"negociaciones"\."id"\s*=\s*"acuerdos"\."negociacion_id"/i,
    );
  });

  it("scopes the rows to the caller's own firmas, never to a caso id they supplied", () => {
    const compiled = buildSignatureInboxQuery(
      createCompileOnlyKysely(),
      "user-a",
    ).compile();

    expect(compiled.sql).toMatch(/where\s+"own"\."usuario_id"\s*=\s*\$\d/i);
    expect(compiled.parameters).toContain("user-a");
  });
});
