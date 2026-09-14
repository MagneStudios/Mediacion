import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  buildReadTerminosQuery,
  ModeracionRepository,
} from "./moderacion.repository";

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

function buildRepository(valor: unknown) {
  const executeTakeFirst = jest
    .fn()
    .mockResolvedValue(valor === undefined ? undefined : { valor });
  const where = jest.fn().mockReturnValue({ executeTakeFirst });
  const select = jest.fn().mockReturnValue({ where });
  const selectFrom = jest.fn().mockReturnValue({ select });
  return {
    repository: new ModeracionRepository({ selectFrom } as never),
    selectFrom,
    where,
  };
}

describe("buildReadTerminosQuery", () => {
  it("reads the moderacion_terminos row of configuracion, read-only", () => {
    const compiled = buildReadTerminosQuery(
      createCompileOnlyKysely(),
    ).compile();

    expect(compiled.sql).toMatch(/^select\s+"valor"\s+from\s+"configuracion"/i);
    expect(compiled.sql.toLowerCase()).toContain('"clave" = ');
    expect(compiled.parameters).toEqual(["moderacion_terminos"]);
  });
});

describe("ModeracionRepository.readTerminos", () => {
  it("returns the configured list", async () => {
    const { repository } = buildRepository(["idiota", "estupido"]);

    await expect(repository.readTerminos()).resolves.toEqual([
      "idiota",
      "estupido",
    ]);
  });

  it("returns an empty list when the key is absent, so nothing is blocked", async () => {
    const { repository } = buildRepository(undefined);

    await expect(repository.readTerminos()).resolves.toEqual([]);
  });

  it("returns an empty list when the value is not an array", async () => {
    const { repository } = buildRepository("idiota");

    await expect(repository.readTerminos()).resolves.toEqual([]);
  });

  it("drops non-string and empty entries instead of trusting the row", async () => {
    const { repository } = buildRepository(["idiota", 42, "", null]);

    await expect(repository.readTerminos()).resolves.toEqual(["idiota"]);
  });
});
