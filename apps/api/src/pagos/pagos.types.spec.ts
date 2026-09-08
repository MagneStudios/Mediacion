import type {
  Plan,
  planColumns,
  SuscripcionForUso,
  SuscripcionVigente,
  SuscripcionVigenteRow,
  suscripcionVigenteColumns,
  UsageCounter,
  UsoView,
  usageCounterColumns,
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

type PlanQuotaColumnsPresent = AssertNever<
  Exclude<
    "max_negotiations_per_period" | "max_clients_per_period",
    AllowlistedColumn
  >
>;

type UsageAllowlistedColumn = (typeof usageCounterColumns)[number];
type UsageKeysBeyondAllowlist = Exclude<
  keyof UsageCounter,
  UsageAllowlistedColumn
>;
type UsageAllowlistColumnsMissing = Exclude<
  UsageAllowlistedColumn,
  keyof UsageCounter
>;
type UsageCounterColumnsMatchAllowlist = AssertNever<
  UsageKeysBeyondAllowlist | UsageAllowlistColumnsMissing
>;
type UsageCounterNeverReadsCreatedAt = AssertNever<
  Extract<UsageAllowlistedColumn, "created_at">
>;

type UsoFieldTypesMatch = {
  negociaciones_limite: SameShape<
    UsoView["negociaciones"]["limite"],
    SuscripcionForUso["max_negotiations_per_period"]
  >;
  clientes_limite: SameShape<
    NonNullable<UsoView["clientes"]>["limite"],
    SuscripcionForUso["max_clients_per_period"]
  >;
  negociaciones_usado: SameShape<
    UsoView["negociaciones"]["usado"],
    UsageCounter["negotiations_created"]
  >;
  clientes_usado: SameShape<
    NonNullable<UsoView["clientes"]>["usado"],
    UsageCounter["clients_created"]
  >;
  plan_limits: SameShape<
    SuscripcionForUso["max_negotiations_per_period"],
    Plan["max_negotiations_per_period"]
  >;
};
type UsoFieldTypeDrift = AssertNever<
  {
    [Field in keyof UsoFieldTypesMatch]: UsoFieldTypesMatch[Field] extends true
      ? never
      : Field;
  }[keyof UsoFieldTypesMatch]
>;
type UsoViewClientesNullable = SameShape<
  Extract<UsoView["clientes"], null>,
  null
>;

describe("Plan", () => {
  it("exposes exactly the planColumns allowlist — compile guard", () => {
    const guard: PlanColumnsMatchAllowlist extends never ? true : false = true;
    expect(guard).toBe(true);
  });

  it("exposes the two quota columns of GET /planes — compile guard", () => {
    const guard: PlanQuotaColumnsPresent extends never ? true : false = true;
    expect(guard).toBe(true);
  });
});

describe("UsageCounter", () => {
  it("reads exactly the usageCounterColumns allowlist — compile guard", () => {
    const guard: UsageCounterColumnsMatchAllowlist extends never
      ? true
      : false = true;
    expect(guard).toBe(true);
  });

  it("never selects created_at, which db-types declares but the table lacks — compile guard", () => {
    const guard: UsageCounterNeverReadsCreatedAt extends never ? true : false =
      true;
    expect(guard).toBe(true);
  });
});

describe("UsoView", () => {
  it("keeps every medidor field's type in step with the column it comes from — compile guard", () => {
    const guard: UsoFieldTypeDrift extends never ? true : false = true;
    expect(guard).toBe(true);
  });

  it("keeps clientes nullable so non-estudio accounts get null, not a fake unlimited — compile guard", () => {
    const guard: UsoViewClientesNullable = true;
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
