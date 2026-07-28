import type {
  Incumplimiento,
  incumplimientoViewColumns,
} from "./incumplimientos.types";

type AllowlistedColumn = (typeof incumplimientoViewColumns)[number];
type KeysBeyondAllowlist = Exclude<keyof Incumplimiento, AllowlistedColumn>;
type AllowlistColumnsMissing = Exclude<AllowlistedColumn, keyof Incumplimiento>;
type AssertNever<T extends never> = T;
type ColumnsMatchAllowlist = AssertNever<
  KeysBeyondAllowlist | AllowlistColumnsMissing
>;

describe("Incumplimiento", () => {
  it("exposes exactly the incumplimientoViewColumns allowlist — compile guard", () => {
    const guard: ColumnsMatchAllowlist extends never ? true : false = true;
    expect(guard).toBe(true);
  });
});
