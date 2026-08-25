/**
 * Domain type for the `planes` table (subscription plans) — mirrors
 * `mediacion.dbml`'s `planes` shape exactly.
 *
 * R-10 (cambios reunión 07/08): `limiteCasos` became nullable —
 * `null` means ilimitado. That is the ONE column the migration changed.
 * `limiteCarpetas`/`limiteIteracionesIa` keep the schema's pre-existing
 * `-1 = ilimitado` sentinel convention (still `int not null`) — they were
 * not made nullable, so the two "unlimited" encodings coexist by design,
 * not by accident: `mocks/plans.ts` mirrors both, seeded from the real
 * migrations (`base`/`simple`/`plus` from the original seed still use `-1`
 * for casos; only `estudio`'s row was updated to the new `null` convention).
 *
 * `precio` is the net price, without taxes (R-09) — `configuracion.impuestos`
 * (not modeled here yet) is what turns it into a checkout total.
 *
 * `moneda` (punto #24) mirrors `planes.moneda`: the currency the gateway
 * actually charges (`'ARS'` today, enforced by the DB CHECK). The UI never
 * invents a currency literal — it always formats with this field.
 */
export type Plan = {
  id: string;
  nombre: string;
  limiteCarpetas: number;
  limiteCasos: number | null;
  limiteIteracionesIa: number;
  precio: number;
  moneda: string;
};

/**
 * `moneda` is optional here because it mirrors the DB Insert shape: the
 * column has a default (`'ARS'`) and the admin ABM has no currency picker
 * (deliberately — adding one is a product decision, see the spec's
 * "Ask First"). The mock CRUD applies the same default the DB would.
 */
export type PlanInput = {
  nombre: string;
  limiteCarpetas: number;
  limiteCasos: number | null;
  limiteIteracionesIa: number;
  precio: number;
  moneda?: string;
};

/**
 * Admin-form presentation state for one limit field (`features/admin/planes`
 * form screens) — never persisted as-is. `unlimited: true` maps to the
 * sentinel (`null` for limiteCasos, `-1` for the other two); `false` means
 * `value` (raw input text) holds a concrete number to parse on submit.
 */
export type LimitFieldValue = {
  unlimited: boolean;
  value: string;
};
