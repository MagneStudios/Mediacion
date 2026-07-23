import type { PropuestaView } from "./negociacion.types";

type ForbiddenKeys = "valor_min" | "valor_max";
type LeakedKeys = Extract<keyof PropuestaView, ForbiddenKeys>;
type AssertNever<T extends never> = T;
type PropuestaViewNeverLeaksItemRanges = AssertNever<LeakedKeys>;

describe("PropuestaView", () => {
  it("structurally omits valor_min and valor_max — RN-01 compile guard", () => {
    const assertion: PropuestaViewNeverLeaksItemRanges extends never
      ? true
      : false = true;
    expect(assertion).toBe(true);
  });
});
