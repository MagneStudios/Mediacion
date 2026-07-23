import { HttpException } from "@nestjs/common";
import type { PropuestaConRespuestas } from "./acuerdos.types";
import { buildAgreementContent } from "./agreement-content";

describe("buildAgreementContent", () => {
  it("maps the accepted propuesta and its respuestas to the acuerdo contenido", () => {
    const accepted: PropuestaConRespuestas = {
      propuesta: {
        id: "propuesta-1",
        caso_id: "caso-1",
        ronda_id: "ronda-1",
        contenido: { split: "50/50" },
        fundamentacion: "Acuerdo justo",
        estado: "aceptada",
        modelo_ia: "openai/gpt-4",
        fecha: "2026-07-01T00:00:00.000Z",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
      respuestas: [
        {
          id: "respuesta-1",
          propuesta_id: "propuesta-1",
          parte_id: "user-a",
          decision: "acepta",
          fecha: "2026-07-02T00:00:00.000Z",
          created_at: "2026-07-02T00:00:00.000Z",
        },
      ],
    };

    const contenido = buildAgreementContent(accepted);

    expect(contenido).toEqual({
      propuesta_id: "propuesta-1",
      contenido: { split: "50/50" },
      fundamentacion: "Acuerdo justo",
      modelo_ia: "openai/gpt-4",
      respuestas: [
        {
          parte_id: "user-a",
          decision: "acepta",
          fecha: "2026-07-02T00:00:00.000Z",
        },
      ],
    });
  });

  it("throws a 422 when there is no accepted propuesta", () => {
    let thrown: unknown;
    try {
      buildAgreementContent(undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(422);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({ code: "accepted_propuesta_not_found" }),
    );
  });
});
