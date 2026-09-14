import type { AgreementDocumentInput } from "./acuerdo-export";
import { buildAgreementPdf } from "./acuerdo-pdf";

function buildAcuerdo(
  overrides?: Partial<AgreementDocumentInput>,
): AgreementDocumentInput {
  return {
    id: "acuerdo-1",
    caso_id: "caso-1",
    estado: "borrador",
    fecha: "2026-09-14T10:00:00.000Z",
    documento_url: null,
    contenido: {
      propuesta_id: "prop-1",
      fundamentacion: "Las partes acordaron sobre la base del punto medio.",
      contenido: {
        meetingPoint: [
          { categoria: "bienes", punto: 100, estado: "acordable" },
          { categoria: "cuidado_ninos", punto: null, estado: "negociable" },
        ],
      },
      respuestas: [
        {
          parte_id: "user-a",
          decision: "aceptada",
          fecha: "2026-09-13T10:00:00.000Z",
        },
      ],
    },
    ...overrides,
  } as AgreementDocumentInput;
}

function render(acuerdo: AgreementDocumentInput): string {
  return buildAgreementPdf(acuerdo).toString("latin1");
}

describe("buildAgreementPdf", () => {
  it("emits a real PDF, not plain text: version header and EOF trailer", () => {
    const pdf = buildAgreementPdf(buildAcuerdo());

    const rendered = pdf.toString("latin1");
    expect(pdf).toBeInstanceOf(Buffer);
    expect(rendered.startsWith("%PDF-1.4")).toBe(true);
    expect(rendered.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(rendered).toContain("/Type /Catalog");
    expect(rendered).toContain("startxref");
  });

  it("lays out encabezado, cuerpo and cierre in that order", () => {
    const rendered = render(buildAcuerdo());

    const encabezado = rendered.indexOf("ACUERDO DE MEDIACI");
    const puntos = rendered.indexOf("PUNTOS ACORDADOS");
    const cronograma = rendered.indexOf("CRONOGRAMA");
    const fundamentacion = rendered.indexOf("FUNDAMENTACI");
    const cierre = rendered.indexOf("CIERRE");

    expect(encabezado).toBeGreaterThanOrEqual(0);
    expect(puntos).toBeGreaterThan(encabezado);
    expect(cronograma).toBeGreaterThan(puntos);
    expect(fundamentacion).toBeGreaterThan(cronograma);
    expect(cierre).toBeGreaterThan(fundamentacion);
  });

  it("renders the agreed points as an aligned table with their labels", () => {
    const rendered = render(buildAcuerdo());

    expect(rendered).toContain("Categor");
    expect(rendered).toContain("Bienes");
    expect(rendered).toContain("100");
    expect(rendered).toContain("Cuidado de ni");
    expect(rendered).toContain("a definir entre las partes");
  });

  it("embeds the schedule as a table of day, time, activity and who is in charge", () => {
    const acuerdo = buildAcuerdo({
      contenido: {
        contenido: {
          meetingPoint: [],
          cronograma: [
            {
              dia: "lunes",
              desde: "14:00",
              hasta: "16:00",
              actividad: "Natación",
              a_cargo: "Madre",
            },
            {
              dia: "miercoles",
              desde: "18:00",
              hasta: "19:30",
              actividad: "Inglés",
              a_cargo: "Padre",
            },
          ],
        },
      },
    } as Partial<AgreementDocumentInput>);

    const rendered = render(acuerdo);

    expect(rendered).toContain("Lunes");
    expect(rendered).toContain("14:00 a 16:00");
    expect(rendered).toContain("Nataci");
    expect(rendered).toContain("Madre");
    expect(rendered).toContain("Mi");
    expect(rendered).toContain("18:00 a 19:30");
    expect(rendered).toContain("Padre");
    expect(rendered).not.toContain("Sin cronograma cargado");
  });

  it("says the schedule is missing instead of drawing an empty table", () => {
    const rendered = render(buildAcuerdo());

    expect(rendered).toContain("Sin cronograma cargado para este caso.");
  });

  it("carries the parties' conformity and the signed document url into the cierre", () => {
    const rendered = render(
      buildAcuerdo({ documento_url: "https://signnow.test/doc-1" }),
    );

    expect(rendered).toContain("Conformidad de las partes:");
    expect(rendered).toContain("user-a");
    expect(rendered).toContain("aceptada");
    expect(rendered).toContain("https://signnow.test/doc-1");
  });

  it("escapes parentheses so a value cannot break out of the PDF text literal", () => {
    const acuerdo = buildAcuerdo({
      contenido: {
        fundamentacion: "Acuerdo (parcial) sobre bienes",
        contenido: { meetingPoint: [] },
      },
    } as Partial<AgreementDocumentInput>);

    const rendered = render(acuerdo);

    expect(rendered).toContain("\\(parcial\\)");
    expect(rendered).not.toContain("(parcial)");
  });

  it("paginates a long fundamentacion instead of drawing off the page", () => {
    const acuerdo = buildAcuerdo({
      contenido: {
        fundamentacion: Array.from({ length: 1200 }, () => "palabra").join(" "),
        contenido: { meetingPoint: [] },
      },
    } as Partial<AgreementDocumentInput>);

    const rendered = render(acuerdo);

    expect(rendered).toContain("/Count 2");
  });
});
