import type {
  Plan,
  planColumns,
  SuscripcionVigente,
  SuscripcionVigenteRow,
  suscripcionVigenteColumns,
} from "./pagos.types";

type AllowlistedColumn = (typeof planColumns)[number];
type PlanKeysBeyondAllowlist = Exclude<keyof Plan, AllowlistedColumn>;
type AllowlistColumnsMissingFromPlan = Exclude<AllowlistedColumn, keyof Plan>;
type AssertNever<T extends never> = T;
type PlanColumnsMatchAllowlist = AssertNever<
  PlanKeysBeyondAllowlist | AllowlistColumnsMissingFromPlan
>;

type VigenteAllowlistedColumn = (typeof suscripcionVigenteColumns)[number];
type VigenteRowKeysBeyondAllowlist = Exclude<
  keyof SuscripcionVigenteRow,
  VigenteAllowlistedColumn
>;
type VigenteAllowlistColumnsMissingFromRow = Exclude<
  VigenteAllowlistedColumn,
  keyof SuscripcionVigenteRow
>;
type SuscripcionVigenteColumnsMatchAllowlist = AssertNever<
  VigenteRowKeysBeyondAllowlist | VigenteAllowlistColumnsMissingFromRow
>;

type VigenteViewKeysBeyondRow = Exclude<
  keyof SuscripcionVigente,
  keyof SuscripcionVigenteRow
>;
type VigenteRowKeysMissingFromView = Exclude<
  keyof SuscripcionVigenteRow,
  keyof SuscripcionVigente
>;
type SuscripcionVigenteViewMatchesRow = AssertNever<
  VigenteViewKeysBeyondRow | VigenteRowKeysMissingFromView
>;

/**
 * Comparing key names alone would miss a column changing TYPE, which is the
 * hazard AGENTS.md documents: the driver hands back `Date` where db-types says
 * `string`, so the view's fields must stay the normalized shape the service
 * produces. These check assignability in both directions per field.
 */
type SameShape<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type VigenteFieldTypesMatch = {
  id: SameShape<SuscripcionVigente["id"], SuscripcionVigenteRow["id"]>;
  plan_id: SameShape<
    SuscripcionVigente["plan_id"],
    SuscripcionVigenteRow["plan_id"]
  >;
  estado: SameShape<
    SuscripcionVigente["estado"],
    SuscripcionVigenteRow["estado"]
  >;
  fecha_inicio: SameShape<
    SuscripcionVigente["fecha_inicio"],
    SuscripcionVigenteRow["fecha_inicio"]
  >;
  fecha_fin: SameShape<
    SuscripcionVigente["fecha_fin"],
    SuscripcionVigenteRow["fecha_fin"]
  >;
};
type VigenteFieldTypeDrift = AssertNever<
  {
    [Field in keyof VigenteFieldTypesMatch]: VigenteFieldTypesMatch[Field] extends true
      ? never
      : Field;
  }[keyof VigenteFieldTypesMatch]
>;

describe("Plan", () => {
  it("exposes exactly the planColumns allowlist — compile guard", () => {
    const guard: PlanColumnsMatchAllowlist extends never ? true : false = true;
    expect(guard).toBe(true);
  });
});

describe("SuscripcionVigente", () => {
  it("reads exactly the suscripcionVigenteColumns allowlist — compile guard", () => {
    const guard: SuscripcionVigenteColumnsMatchAllowlist extends never
      ? true
      : false = true;
    expect(guard).toBe(true);
  });

  it("exposes the same fields it reads — compile guard", () => {
    const guard: SuscripcionVigenteViewMatchesRow extends never ? true : false =
      true;
    expect(guard).toBe(true);
  });

  it("keeps every field's type in step with the column it reads — compile guard", () => {
    const guard: VigenteFieldTypeDrift extends never ? true : false = true;
    expect(guard).toBe(true);
  });
});
