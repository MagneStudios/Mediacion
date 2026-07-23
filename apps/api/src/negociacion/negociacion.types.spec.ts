import type { PropuestaView, propuestaViewColumns } from "./negociacion.types";

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

describe("PropuestaView", () => {
  it("exposes exactly the propuestaViewColumns allowlist — RN-01 compile guard", () => {
    const guard: PropuestaViewMatchesAllowlist extends never ? true : false =
      true;
    expect(guard).toBe(true);
  });
});
