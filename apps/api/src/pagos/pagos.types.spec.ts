import type { Plan, planColumns } from "./pagos.types";

type AllowlistedColumn = (typeof planColumns)[number];
type PlanKeysBeyondAllowlist = Exclude<keyof Plan, AllowlistedColumn>;
type AllowlistColumnsMissingFromPlan = Exclude<AllowlistedColumn, keyof Plan>;
type AssertNever<T extends never> = T;
type PlanColumnsMatchAllowlist = AssertNever<
  PlanKeysBeyondAllowlist | AllowlistColumnsMissingFromPlan
>;

describe("Plan", () => {
  it("exposes exactly the planColumns allowlist — compile guard", () => {
    const guard: PlanColumnsMatchAllowlist extends never ? true : false = true;
    expect(guard).toBe(true);
  });
});
