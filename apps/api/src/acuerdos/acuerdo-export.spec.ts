import {
  agreementDocumentFilename,
  buildAgreementDocument,
} from "./acuerdo-export";

const baseAcuerdo = {
  id: "acuerdo-1",
  caso_id: "caso-1",
  estado: "firmado" as const,
  fecha: "2026-07-28T10:00:00.000Z",
  documento_url: "https://docs.example.com/acuerdo-1.pdf",
  contenido: {
    contenido: {
      meetingPoint: [
        { categoria: "economico", punto: 1500 },
        { categoria: "cuidado_ninos", punto: null },
      ],
      narrative: null,
    },
    fundamentacion: "Ambas partes acordaron el punto medio.",
  },
};

describe("agreementDocumentFilename", () => {
  it("names the export after the agreement id", () => {
    expect(agreementDocumentFilename("acuerdo-1")).toBe(
      "acuerdo-acuerdo-1.txt",
    );
  });
});

describe("buildAgreementDocument", () => {
  it("renders the header, the agreed points and the reasoning", () => {
    const document = buildAgreementDocument(baseAcuerdo);

    expect(document).toContain("ACUERDO DE MEDIACIÓN");
    expect(document).toContain("Identificador: acuerdo-1");
    expect(document).toContain("Caso: caso-1");
    expect(document).toContain("Estado: firmado");
    expect(document).toContain("Fecha: 2026-07-28T10:00:00.000Z");
    expect(document).toContain(
      "Documento firmado: https://docs.example.com/acuerdo-1.pdf",
    );
    expect(document).toContain("- Económico: 1500");
    expect(document).toContain(
      "- Cuidado de niños: a definir entre las partes",
    );
    expect(document).toContain("Ambas partes acordaron el punto medio.");
  });

  it("renders placeholders when optional fields are absent", () => {
    const document = buildAgreementDocument({
      ...baseAcuerdo,
      fecha: null,
      documento_url: null,
      contenido: {},
    });

    expect(document).toContain("Fecha: —");
    expect(document).toContain("Documento firmado: —");
    expect(document).toContain("PUNTOS ACORDADOS\n—");
    expect(document).toContain("FUNDAMENTACIÓN\n—");
  });

  it("is deterministic for the same agreement", () => {
    expect(buildAgreementDocument(baseAcuerdo)).toBe(
      buildAgreementDocument(baseAcuerdo),
    );
  });

  it("tolerates malformed contenido without throwing", () => {
    expect(() =>
      buildAgreementDocument({ ...baseAcuerdo, contenido: "texto" }),
    ).not.toThrow();
    expect(() =>
      buildAgreementDocument({ ...baseAcuerdo, contenido: null }),
    ).not.toThrow();
  });
});
