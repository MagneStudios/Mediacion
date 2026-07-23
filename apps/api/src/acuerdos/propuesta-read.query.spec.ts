import { readAcceptedPropuesta } from "./propuesta-read.query";

describe("readAcceptedPropuesta", () => {
  function createFakeKysely(options: {
    propuesta: unknown;
    respuestas: unknown[];
  }) {
    const propuestaExecuteTakeFirst = jest
      .fn()
      .mockResolvedValue(options.propuesta);
    const propuestaOrderBy2 = jest
      .fn()
      .mockReturnValue({ executeTakeFirst: propuestaExecuteTakeFirst });
    const propuestaOrderBy1 = jest
      .fn()
      .mockReturnValue({ orderBy: propuestaOrderBy2 });
    const propuestaWhere2 = jest
      .fn()
      .mockReturnValue({ orderBy: propuestaOrderBy1 });
    const propuestaWhere1 = jest
      .fn()
      .mockReturnValue({ where: propuestaWhere2 });
    const propuestaSelectAll = jest
      .fn()
      .mockReturnValue({ where: propuestaWhere1 });

    const respuestasExecute = jest.fn().mockResolvedValue(options.respuestas);
    const respuestasWhere = jest
      .fn()
      .mockReturnValue({ execute: respuestasExecute });
    const respuestasSelectAll = jest
      .fn()
      .mockReturnValue({ where: respuestasWhere });

    const selectFrom = jest.fn((table: string) => {
      if (table === "propuestas") {
        return { selectAll: propuestaSelectAll };
      }
      if (table === "respuestas_propuesta") {
        return { selectAll: respuestasSelectAll };
      }
      throw new Error(`unexpected table ${table}`);
    });

    return {
      selectFrom,
      propuestaWhere1,
      propuestaWhere2,
      propuestaOrderBy1,
      propuestaOrderBy2,
      respuestasWhere,
    };
  }

  it("loads the accepted propuesta and its respuestas for the caso", async () => {
    const propuesta = {
      id: "propuesta-1",
      caso_id: "caso-1",
      estado: "aceptada",
    };
    const respuestas = [{ id: "respuesta-1", propuesta_id: "propuesta-1" }];
    const fakeKysely = createFakeKysely({ propuesta, respuestas });

    const result = await readAcceptedPropuesta(fakeKysely as never, "caso-1");

    expect(fakeKysely.propuestaWhere1).toHaveBeenCalledWith(
      "caso_id",
      "=",
      "caso-1",
    );
    expect(fakeKysely.propuestaWhere2).toHaveBeenCalledWith(
      "estado",
      "=",
      "aceptada",
    );
    expect(fakeKysely.propuestaOrderBy1).toHaveBeenCalledWith(
      "created_at",
      "desc",
    );
    expect(fakeKysely.propuestaOrderBy2).toHaveBeenCalledWith("id", "desc");
    expect(fakeKysely.respuestasWhere).toHaveBeenCalledWith(
      "propuesta_id",
      "=",
      "propuesta-1",
    );
    expect(result).toEqual({ propuesta, respuestas });
  });

  it("returns undefined and skips the respuestas query when no accepted propuesta exists", async () => {
    const fakeKysely = createFakeKysely({
      propuesta: undefined,
      respuestas: [],
    });

    const result = await readAcceptedPropuesta(fakeKysely as never, "caso-1");

    expect(result).toBeUndefined();
    expect(fakeKysely.selectFrom).toHaveBeenCalledTimes(1);
  });
});
