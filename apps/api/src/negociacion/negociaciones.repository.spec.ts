import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
  buildFindNegociacionByIdQuery,
  buildFindRenegociableQuery,
  buildInsertAcuerdoSiguienteQuery,
  buildInsertNegociacionQuery,
  buildListNegociacionesByCasoQuery,
  buildMarkNegociacionAcordadaQuery,
  buildReactivarNegociacionQuery,
  buildResolveNegociacionByPropuestaQuery,
  buildResolveNegociacionRoundByPropuestaQuery,
  buildSupersedeAcuerdoQuery,
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
      {} as never,
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
      {} as never,
    );

    const [negociacion] = await repository.listByCaso("caso-1");

    expect(negociacion.acuerdo_vigente).toBeNull();
  });

  it("keeps a legacy negociacion's subject_type null instead of filling it with 'otro'", async () => {
    const repository = new NegociacionesRepository(
      createFakeKysely([legacyRow]) as never,
      {} as never,
    );

    const [negociacion] = await repository.listByCaso("caso-1");

    expect(negociacion.subject_type).toBeNull();
  });

  it("returns an empty list for a caso with no negociaciones", async () => {
    const repository = new NegociacionesRepository(
      createFakeKysely([]) as never,
      {} as never,
    );

    await expect(repository.listByCaso("caso-1")).resolves.toEqual([]);
  });
});

describe("buildResolveNegociacionByPropuestaQuery", () => {
  it("reads the negociacion straight off the propuesta, with no walk through rondas", () => {
    const compiled = buildResolveNegociacionByPropuestaQuery(
      createCompileOnlyKysely(),
      "prop-1",
    ).compile();

    expect(compiled.sql).toMatch(
      /^select "negociacion_id" from "propuestas" where "id" = \$\d/i,
    );
    expect(compiled.sql).not.toMatch(/join|rondas/i);
    expect(compiled.parameters).toContain("prop-1");
  });
});

describe("buildMarkNegociacionAcordadaQuery", () => {
  it("marks one negociacion acordada, scoped to its id so sibling materias are untouched", () => {
    const compiled = buildMarkNegociacionAcordadaQuery(
      createCompileOnlyKysely(),
      "negociacion-1",
    ).compile();

    expect(compiled.sql).toMatch(
      /^update "negociaciones" set "estado" = \$\d/i,
    );
    expect(compiled.sql).toMatch(/"id" = \$\d/i);
    expect(compiled.parameters).toContain("acordada");
    expect(compiled.parameters).toContain("negociacion-1");
    expect(compiled.sql).not.toContain("caso_id");
  });

  it("guards on the state it is leaving, so a replayed acceptance is a no-op", () => {
    const compiled = buildMarkNegociacionAcordadaQuery(
      createCompileOnlyKysely(),
      "negociacion-1",
    ).compile();

    expect(compiled.sql).toMatch(/"estado" != \$\d/i);
  });

  it("never touches casos: the caso's acordado is derived from the signatures, not from this", () => {
    const compiled = buildMarkNegociacionAcordadaQuery(
      createCompileOnlyKysely(),
      "negociacion-1",
    ).compile();

    expect(compiled.sql).not.toContain('"casos"');
  });
});

describe("NegociacionesRepository.markAcordadaByPropuesta", () => {
  it("resolves the propuesta's negociacion and marks it, both on the caller's trx", async () => {
    const markExecute = jest.fn().mockResolvedValue(undefined);
    const executeTakeFirstOrThrow = jest
      .fn()
      .mockResolvedValue({ negociacion_id: "negociacion-7" });
    const selectWhere = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
    const select = jest.fn().mockReturnValue({ where: selectWhere });
    const selectFrom = jest.fn().mockReturnValue({ select });
    const updateWhere2 = jest.fn().mockReturnValue({ execute: markExecute });
    const updateWhere1 = jest.fn().mockReturnValue({ where: updateWhere2 });
    const set = jest.fn().mockReturnValue({ where: updateWhere1 });
    const updateTable = jest.fn().mockReturnValue({ set });
    const trx = { selectFrom, updateTable };
    const repository = new NegociacionesRepository({} as never, {} as never);

    await repository.markAcordadaByPropuesta("prop-1", trx as never);

    expect(selectFrom).toHaveBeenCalledWith("propuestas");
    expect(selectWhere).toHaveBeenCalledWith("id", "=", "prop-1");
    expect(updateTable).toHaveBeenCalledWith("negociaciones");
    expect(set).toHaveBeenCalledWith({ estado: "acordada" });
    expect(updateWhere1).toHaveBeenCalledWith("id", "=", "negociacion-7");
    expect(markExecute).toHaveBeenCalled();
  });
});

describe("buildFindRenegociableQuery", () => {
  function compile() {
    return buildFindRenegociableQuery(
      createCompileOnlyKysely(),
      "negociacion-1",
    ).compile();
  }

  it("joins the acuerdo in force inner, so a negociacion without one yields no row", () => {
    const compiled = compile();

    expect(compiled.sql).toMatch(/inner join\s+"acuerdos"/i);
    expect(compiled.sql).not.toMatch(/left join/i);
    expect(compiled.sql).toMatch(/"acuerdos"\."vigente"\s*=\s*\$\d/i);
    expect(compiled.parameters).toContain(true);
  });

  it("locks the rows it reads, so two concurrent renegotiations cannot both branch off v1", () => {
    expect(compile().sql).toMatch(/for update/i);
  });

  it("reads everything the next version needs in one round trip", () => {
    const sql = compile().sql;

    for (const column of [
      "caso_id",
      "round",
      "estado",
      "version",
      "contenido",
    ]) {
      expect(sql).toContain(column);
    }
  });
});

describe("buildSupersedeAcuerdoQuery", () => {
  it("retires the agreement instead of deleting it, and only if it is still in force", () => {
    const compiled = buildSupersedeAcuerdoQuery(
      createCompileOnlyKysely(),
      "acuerdo-1",
    ).compile();

    expect(compiled.sql).toMatch(/^update "acuerdos" set "vigente" = \$\d/i);
    expect(compiled.sql).not.toMatch(/delete/i);
    expect(compiled.sql).toMatch(/"vigente" = \$\d/i);
    expect(compiled.parameters).toContain(false);
    expect(compiled.parameters).toContain("acuerdo-1");
  });
});

describe("buildInsertAcuerdoSiguienteQuery", () => {
  it("writes the versioning columns the schema has had without a writer since migration 42", () => {
    const compiled = buildInsertAcuerdoSiguienteQuery(
      createCompileOnlyKysely(),
      {
        caso_id: "caso-1",
        negociacion_id: "negociacion-1",
        version: 1,
        acuerdo_id: "acuerdo-1",
        contenido: { narrative: "previo" },
      },
    ).compile();

    expect(compiled.sql).toContain('"version"');
    expect(compiled.sql).toContain('"supersedes_agreement_id"');
    expect(compiled.sql).toContain('"vigente"');
    expect(compiled.parameters).toContain(2);
    expect(compiled.parameters).toContain("acuerdo-1");
    expect(compiled.parameters).toContain(true);
    expect(compiled.parameters).toContain("borrador");
  });

  it("copies the retired agreement's contenido instead of rendering a new one", () => {
    const contenido = { narrative: "el acuerdo vigente" };
    const compiled = buildInsertAcuerdoSiguienteQuery(
      createCompileOnlyKysely(),
      {
        caso_id: "caso-1",
        negociacion_id: "negociacion-1",
        version: 3,
        acuerdo_id: "acuerdo-3",
        contenido,
      },
    ).compile();

    expect(compiled.parameters).toContainEqual(contenido);
    expect(compiled.parameters).toContain(4);
  });
});

describe("buildReactivarNegociacionQuery", () => {
  it("puts the materia back to activa, scoped to its own id", () => {
    const compiled = buildReactivarNegociacionQuery(
      createCompileOnlyKysely(),
      "negociacion-1",
    ).compile();

    expect(compiled.sql).toMatch(
      /^update "negociaciones" set "estado" = \$\d/i,
    );
    expect(compiled.parameters).toContain("activa");
    expect(compiled.parameters).toContain("negociacion-1");
  });
});

describe("buildFindNegociacionByIdQuery", () => {
  it("reads the caso and the round of one negociacion, read-only", () => {
    const compiled = buildFindNegociacionByIdQuery(
      createCompileOnlyKysely(),
      "negociacion-1",
    ).compile();

    expect(compiled.sql).toMatch(
      /^select\s+"caso_id",\s*"round"\s+from\s+"negociaciones"/i,
    );
    expect(compiled.sql).toMatch(/where\s+"id"\s*=\s*\$\d/i);
    expect(compiled.sql).not.toMatch(/insert|update|delete/i);
    expect(compiled.parameters).toEqual(["negociacion-1"]);
  });
});

describe("buildResolveNegociacionRoundByPropuestaQuery", () => {
  it("joins the propuesta to its own negociacion and reads that round", () => {
    const compiled = buildResolveNegociacionRoundByPropuestaQuery(
      createCompileOnlyKysely(),
      "prop-1",
    ).compile();

    expect(compiled.sql).toMatch(/from\s+"propuestas"/i);
    expect(compiled.sql).toMatch(
      /inner join\s+"negociaciones"\s+on\s+"negociaciones"\."id"\s*=\s*"propuestas"\."negociacion_id"/i,
    );
    expect(compiled.sql).toMatch(/where\s+"propuestas"\."id"\s*=\s*\$\d/i);
    expect(compiled.sql).not.toMatch(/"materia"/i);
    expect(compiled.parameters).toEqual(["prop-1"]);
  });
});

describe("buildInsertNegociacionQuery", () => {
  function compile() {
    return buildInsertNegociacionQuery(
      createCompileOnlyKysely(),
      "caso-1",
      "alimentos",
      "mediacion",
    ).compile();
  }

  it("inserts the materia and the caso's metodo, leaving estado and round to their defaults", () => {
    const compiled = compile();

    expect(compiled.sql).toMatch(
      /^insert into "negociaciones" \("caso_id", "materia", "method"\) values \(\$1, \$2, \$3\)/i,
    );
    expect(compiled.parameters).toEqual(["caso-1", "alimentos", "mediacion"]);
  });

  it("leans on negociaciones_caso_materia_unique instead of an existence check", () => {
    const compiled = compile();

    expect(compiled.sql).toMatch(
      /on conflict\s*\(\s*"caso_id",\s*"materia"\s*\)\s*do nothing/i,
    );
  });

  it("returns the view columns, never the materia column it was given", () => {
    const compiled = compile();

    expect(compiled.sql).toMatch(/returning/i);
    expect(compiled.sql).toMatch(/"method"\s+as\s+"metodo"/i);
    expect(compiled.sql).toMatch(/"round"\s+as\s+"ronda_actual"/i);
  });
});

describe("NegociacionesRepository.crear", () => {
  function createFakeInsertKysely(inserted: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(inserted);
    const returning = jest.fn().mockReturnValue({ executeTakeFirst });
    const onConflict = jest.fn().mockReturnValue({ returning });
    const values = jest.fn().mockReturnValue({ onConflict });
    const insertInto = jest.fn().mockReturnValue({ values });
    const trx = { insertInto };
    const execute = jest.fn((callback: (trx: unknown) => unknown) =>
      callback(trx),
    );
    return {
      kysely: { transaction: jest.fn(() => ({ execute })) },
      trx,
      insertInto,
      values,
    };
  }

  it("returns the new materia with no acuerdo in force and reopens the caso in the same trx", async () => {
    const fake = createFakeInsertKysely({
      id: "negociacion-2",
      caso_id: "caso-1",
      metodo: "mediacion",
      estado: "borrador",
      ronda_actual: 1,
      created_at: "2026-09-10T10:00:00.000Z",
    });
    const reopenFromAcordado = jest.fn().mockResolvedValue(undefined);
    const repository = new NegociacionesRepository(
      fake.kysely as never,
      {
        reopenFromAcordado,
      } as never,
    );

    const result = await repository.crear("caso-1", "alimentos", "mediacion");

    expect(fake.values).toHaveBeenCalledWith({
      caso_id: "caso-1",
      materia: "alimentos",
      method: "mediacion",
    });
    expect(reopenFromAcordado).toHaveBeenCalledWith("caso-1", fake.trx);
    expect(result).toEqual({
      id: "negociacion-2",
      caso_id: "caso-1",
      subject_type: "alimentos",
      metodo: "mediacion",
      estado: "borrador",
      ronda_actual: 1,
      acuerdo_vigente: null,
      created_at: "2026-09-10T10:00:00.000Z",
    });
  });

  it("reports a materia the caso already has as 409, without reopening it", async () => {
    const fake = createFakeInsertKysely(undefined);
    const reopenFromAcordado = jest.fn();
    const repository = new NegociacionesRepository(
      fake.kysely as never,
      {
        reopenFromAcordado,
      } as never,
    );

    let thrown: unknown;
    try {
      await repository.crear("caso-1", "alimentos", "mediacion");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({ code: "negociacion_materia_already_exists" }),
    );
    expect(reopenFromAcordado).not.toHaveBeenCalled();
  });
});
