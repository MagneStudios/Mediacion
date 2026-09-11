import type { MateriaAcuerdo, PropuestaView } from "./negociacion.types";
import { materiasAcuerdo, propuestaViewColumns } from "./negociacion.types";

type AllowlistedColumn = (typeof propuestaViewColumns)[number];
type ViewKeysBeyondAllowlist = Exclude<keyof PropuestaView, AllowlistedColumn>;
type AllowlistColumnsMissingFromView = Exclude<
  AllowlistedColumn,
  keyof PropuestaView
>;
type AssertNever<T extends never> = T;
type PropuestaViewMatchesAllowlist = AssertNever<
  ViewKeysBeyondAllowlist | AllowlistColumnsMissingFromView
>;

type ListedMateria = (typeof materiasAcuerdo)[number];
type MateriaMissingFromList = Exclude<MateriaAcuerdo, ListedMateria>;
type ListedValueThatIsNotAMateria = Exclude<ListedMateria, MateriaAcuerdo>;
type MateriaListCoversEnum = AssertNever<
  MateriaMissingFromList | ListedValueThatIsNotAMateria
>;

describe("PropuestaView", () => {
  it("exposes exactly the propuestaViewColumns allowlist — RN-01 compile guard", () => {
    const guard: PropuestaViewMatchesAllowlist extends never ? true : false =
      true;
    expect(guard).toBe(true);
  });

  it("carries the negociacion a propuesta belongs to", () => {
    expect(propuestaViewColumns).toContain("negociacion_id");
  });
});

describe("materiasAcuerdo", () => {
  it("covers every materia_acuerdo enum value — compile guard", () => {
    const guard: MateriaListCoversEnum extends never ? true : false = true;
    expect(guard).toBe(true);
  });

  it("lists the four materias a caller may open a negociacion for", () => {
    expect(materiasAcuerdo).toEqual([
      "tenencia",
      "alimentos",
      "bienes",
      "otro",
    ]);
  });
});
