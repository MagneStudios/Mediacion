import type { Json } from "@mediacion/db-types";
import { buildTareasFromAcuerdo } from "./tarea-generation";

const acuerdoId = "11111111-1111-1111-1111-111111111111";
const casoId = "22222222-2222-2222-2222-222222222222";

function contenidoWith(meetingPoint: Json): Json {
  return {
    propuesta_id: "33333333-3333-3333-3333-333333333333",
    contenido: { meetingPoint, narrative: null },
    fundamentacion: null,
    modelo_ia: null,
    respuestas: [],
  };
}

describe("buildTareasFromAcuerdo", () => {
  it("derives one pending accionable per meeting point entry", () => {
    const tareas = buildTareasFromAcuerdo(
      acuerdoId,
      casoId,
      contenidoWith([
        { categoria: "cuidado_ninos", punto: null, estado: "negociable" },
        { categoria: "economico", punto: 1500, estado: "acordable" },
      ]),
    );

    expect(tareas).toEqual([
      {
        acuerdo_id: acuerdoId,
        caso_id: casoId,
        tipo: "tarea",
        descripcion: "Cuidado de niños — cumplir lo acordado",
      },
      {
        acuerdo_id: acuerdoId,
        caso_id: casoId,
        tipo: "tarea",
        descripcion: "Económico — punto acordado: 1500",
      },
    ]);
  });

  it("labels every known categoria and falls back to the raw value", () => {
    const tareas = buildTareasFromAcuerdo(
      acuerdoId,
      casoId,
      contenidoWith([
        { categoria: "cronogramas", punto: null },
        { categoria: "bienes", punto: null },
        { categoria: "personalizado", punto: null },
        { categoria: "categoria_futura", punto: null },
      ]),
    );

    expect(tareas.map((tarea) => tarea.descripcion)).toEqual([
      "Cronogramas — cumplir lo acordado",
      "Bienes — cumplir lo acordado",
      "Personalizado — cumplir lo acordado",
      "categoria_futura — cumplir lo acordado",
    ]);
  });

  it("returns no tareas when the agreement carries no meeting point", () => {
    expect(
      buildTareasFromAcuerdo(acuerdoId, casoId, contenidoWith([])),
    ).toEqual([]);
  });

  it("ignores malformed contenido instead of throwing", () => {
    expect(buildTareasFromAcuerdo(acuerdoId, casoId, null)).toEqual([]);
    expect(buildTareasFromAcuerdo(acuerdoId, casoId, "texto")).toEqual([]);
    expect(buildTareasFromAcuerdo(acuerdoId, casoId, [1, 2])).toEqual([]);
    expect(buildTareasFromAcuerdo(acuerdoId, casoId, {})).toEqual([]);
    expect(
      buildTareasFromAcuerdo(acuerdoId, casoId, { contenido: "texto" }),
    ).toEqual([]);
    expect(
      buildTareasFromAcuerdo(acuerdoId, casoId, {
        contenido: { meetingPoint: "no-es-lista" },
      }),
    ).toEqual([]);
  });

  it("skips meeting point entries without a usable categoria", () => {
    const tareas = buildTareasFromAcuerdo(
      acuerdoId,
      casoId,
      contenidoWith([
        { punto: 10 },
        { categoria: "", punto: 10 },
        { categoria: 42, punto: 10 },
        { categoria: "bienes", punto: 10 },
      ]),
    );

    expect(tareas).toHaveLength(1);
    expect(tareas[0]?.descripcion).toBe("Bienes — punto acordado: 10");
  });

  it("treats a non-numeric punto as no agreed value", () => {
    const tareas = buildTareasFromAcuerdo(
      acuerdoId,
      casoId,
      contenidoWith([{ categoria: "bienes", punto: "1500" }]),
    );

    expect(tareas[0]?.descripcion).toBe("Bienes — cumplir lo acordado");
  });
});
