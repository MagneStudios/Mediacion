import { buildAvisoEvento, diasDeAnticipacion } from "./aviso-evento";
import type { PublicacionProgramada } from "./legal.types";

const publicacion: PublicacionProgramada = {
  tipo: "terms",
  version: "v2.0",
  valid_from: "2026-09-01T00:00:00.000Z",
  resumen_cambios: null,
};

describe("buildAvisoEvento", () => {
  it("names the document in Spanish and carries the version and the date", () => {
    const evento = buildAvisoEvento(publicacion);

    expect(evento).toContain("Términos y Condiciones");
    expect(evento).toContain("v2.0");
    expect(evento).toContain("2026-09-01T00:00:00.000Z");
  });

  it("appends the plain language summary when there is one", () => {
    expect(
      buildAvisoEvento({
        ...publicacion,
        resumen_cambios: "Cambia el plazo de baja",
      }),
    ).toContain("Qué cambia: Cambia el plazo de baja");
  });

  it("names the privacy document too", () => {
    expect(buildAvisoEvento({ ...publicacion, tipo: "privacy" })).toContain(
      "Política de Privacidad",
    );
  });
});

describe("diasDeAnticipacion", () => {
  it("measures the distance to valid_from in days", () => {
    expect(
      diasDeAnticipacion(publicacion, new Date("2026-08-22T00:00:00.000Z")),
    ).toBe(10);
  });

  it("normalizes the Date the driver returns", () => {
    expect(
      diasDeAnticipacion(
        {
          ...publicacion,
          valid_from: new Date("2026-09-01T00:00:00.000Z") as unknown as string,
        },
        new Date("2026-08-30T00:00:00.000Z"),
      ),
    ).toBe(2);
  });

  it("returns null when valid_from is unusable", () => {
    expect(
      diasDeAnticipacion(
        { ...publicacion, valid_from: "" as unknown as string },
        new Date(),
      ),
    ).toBeNull();
  });
});
