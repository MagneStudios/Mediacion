import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  buildListNegociacionesByCasoQuery,
  NegociacionesRepository,
} from "./negociaciones.repository";

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

function createFakeKysely(rows: unknown[]) {
  const execute = jest.fn().mockResolvedValue(rows);
  const orderBy = jest.fn().mockReturnValue({ execute });
  const where = jest.fn().mockReturnValue({ orderBy });
  const select = jest.fn().mockReturnValue({ where });
  const leftJoin = jest.fn().mockReturnValue({ select });
  const selectFrom = jest.fn().mockReturnValue({ leftJoin });
  return { selectFrom, leftJoin, select, where, orderBy };
}

const legacyRow = {
  id: "negociacion-1",
  caso_id: "caso-1",
  subject_type: null,
  metodo: "mediacion",
  estado: "activa",
  ronda_actual: 2,
  created_at: "2026-09-01T10:00:00.000Z",
  acuerdo_id: null,
  acuerdo_estado: null,
  acuerdo_version: null,
};

describe("buildListNegociacionesByCasoQuery", () => {
  it("reads the negociaciones of one caso, scoped by the caso id", () => {
    const compiled = buildListNegociacionesByCasoQuery(
      createCompileOnlyKysely(),
      "caso-1",
    ).compile();

    expect(compiled.sql).toMatch(/^select .* from "negociaciones"/is);
    expect(compiled.sql).toMatch(
      /where\s+"negociaciones"\."caso_id"\s*=\s*\$\d/i,
    );
    expect(compiled.parameters).toContain("caso-1");
  });

  it("joins only the acuerdo in force, and joins it left so a negociacion without one survives", () => {
    const compiled = buildListNegociacionesByCasoQuery(
      createCompileOnlyKysely(),
      "caso-1",
    ).compile();

    expect(compiled.sql).toMatch(/left join\s+"acuerdos"/i);
    expect(compiled.sql).toMatch(/"acuerdos"\."vigente"\s*=\s*\$\d/i);
    expect(compiled.parameters).toContain(true);
  });

  it("aliases the three fields whose column names the wire does not use", () => {
    const compiled = buildListNegociacionesByCasoQuery(
      createCompileOnlyKysely(),
      "caso-1",
    ).compile();

    expect(compiled.sql).toContain('"materia" as "subject_type"');
    expect(compiled.sql).toContain('"method" as "metodo"');
    expect(compiled.sql).toContain('"round" as "ronda_actual"');
  });
});

describe("NegociacionesRepository.listByCaso", () => {
  it("nests the joined acuerdo columns into acuerdo_vigente", async () => {
    const repository = new NegociacionesRepository(
      createFakeKysely([
        {
          ...legacyRow,
          subject_type: "tenencia",
          acuerdo_id: "acuerdo-1",
          acuerdo_estado: "firmado",
          acuerdo_version: 2,
        },
      ]) as never,
    );

    const [negociacion] = await repository.listByCaso("caso-1");

    expect(negociacion.acuerdo_vigente).toEqual({
      id: "acuerdo-1",
      estado: "firmado",
      version: 2,
    });
    expect(negociacion).not.toHaveProperty("acuerdo_id");
    expect(negociacion).not.toHaveProperty("acuerdo_estado");
    expect(negociacion).not.toHaveProperty("acuerdo_version");
  });

  it("reports a negociacion with no acuerdo as null, never as an empty object", async () => {
    const repository = new NegociacionesRepository(
      createFakeKysely([legacyRow]) as never,
    );

    const [negociacion] = await repository.listByCaso("caso-1");

    expect(negociacion.acuerdo_vigente).toBeNull();
  });

  it("keeps a legacy negociacion's subject_type null instead of filling it with 'otro'", async () => {
    const repository = new NegociacionesRepository(
      createFakeKysely([legacyRow]) as never,
    );

    const [negociacion] = await repository.listByCaso("caso-1");

    expect(negociacion.subject_type).toBeNull();
  });

  it("returns an empty list for a caso with no negociaciones", async () => {
    const repository = new NegociacionesRepository(
      createFakeKysely([]) as never,
    );

    await expect(repository.listByCaso("caso-1")).resolves.toEqual([]);
  });
});
