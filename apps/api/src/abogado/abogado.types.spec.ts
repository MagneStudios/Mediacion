import type { SolicitudAbogado, SolicitudAbogadoView } from "./abogado.types";
import {
  buildSolicitudExternalReference,
  isSolicitudAbogadoReference,
  solicitudAbogadoViewColumns,
} from "./abogado.types";

type AssertNever<T extends never> = T;
type UnknownColumn = Exclude<
  (typeof solicitudAbogadoViewColumns)[number],
  keyof SolicitudAbogado
>;
type MissingFromView = Exclude<
  keyof SolicitudAbogadoView,
  (typeof solicitudAbogadoViewColumns)[number]
>;

describe("solicitudAbogadoViewColumns", () => {
  it("names only real columns, and the view exposes exactly them", () => {
    type _NoUnknownColumn = AssertNever<UnknownColumn>;
    type _NoExtraField = AssertNever<MissingFromView>;
    expect(solicitudAbogadoViewColumns).not.toContain("mp_payment_id");
    expect(solicitudAbogadoViewColumns).not.toContain("mp_preference_id");
    expect(solicitudAbogadoViewColumns).not.toContain("case_summary");
  });
});

describe("external reference", () => {
  it("prefixes the solicitud id so the webhook can tell it from a suscripcion", () => {
    expect(buildSolicitudExternalReference("abc-123")).toBe("lawreq_abc-123");
  });

  it("recognises its own references and rejects a bare suscripcion uuid", () => {
    expect(isSolicitudAbogadoReference("lawreq_abc-123")).toBe(true);
    expect(
      isSolicitudAbogadoReference("6f1e7a2c-0000-4000-8000-000000000000"),
    ).toBe(false);
  });
});
