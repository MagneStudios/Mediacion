import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  buildReadIaConfigQuery,
  ConfiguracionRepository,
} from "./configuracion.repository";

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

describe("buildReadIaConfigQuery", () => {
  it("selects clave and valor from configuracion, scoped to the three ia keys", () => {
    const db = createCompileOnlyKysely();

    const compiled = buildReadIaConfigQuery(db).compile();

    expect(compiled.sql).toMatch(
      /^select\s+"clave",\s*"valor"\s+from\s+"configuracion"/i,
    );
    expect(compiled.sql).toMatch(/where\s+"clave"\s+in/i);
    expect(compiled.parameters).toEqual([
      "ia_modelo",
      "ia_temperature",
      "ia_max_tokens",
    ]);
  });
});

describe("ConfiguracionRepository", () => {
  function createFakeKysely(rows: Array<{ clave: string; valor: unknown }>) {
    const execute = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ execute });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return { selectFrom, select, where, execute };
  }

  it("maps configuracion rows into modelo/temperature/maxTokens", async () => {
    const fakeKysely = createFakeKysely([
      { clave: "ia_modelo", valor: "openai/gpt-4" },
      { clave: "ia_temperature", valor: 0.7 },
      { clave: "ia_max_tokens", valor: 2000 },
    ]);
    const repository = new ConfiguracionRepository(fakeKysely as never);

    const result = await repository.readIaConfig();

    expect(result).toEqual({
      modelo: "openai/gpt-4",
      temperature: 0.7,
      maxTokens: 2000,
    });
  });

  it("throws explicitly when a required ia configuration key is missing", async () => {
    const fakeKysely = createFakeKysely([
      { clave: "ia_modelo", valor: "openai/gpt-4" },
    ]);
    const repository = new ConfiguracionRepository(fakeKysely as never);

    await expect(repository.readIaConfig()).rejects.toThrow();
  });
});
