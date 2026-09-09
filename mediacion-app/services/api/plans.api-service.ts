import type { Plan } from '@/types/plan';

import type { HttpClient } from './http-client';

/**
 * The one plan endpoint that exists on the real API: `GET /planes`
 * (`apps/api/src/pagos/planes.controller.ts`), Bearer, read-only. The shape is
 * the `planColumns` allowlist of `pagos/pagos.types.ts` — snake_case, straight
 * off the `planes` row, with no projection in between.
 *
 * There is deliberately nothing here for the admin ABM: `POST`/`PATCH`/
 * `DELETE /planes` do not exist. See `plans.backed-service.ts` for what that
 * leaves unavailable rather than mocked.
 */
export type ApiPlan = {
  id: string;
  nombre: string;
  limite_carpetas: number;
  limite_casos: number | null;
  limite_iteraciones_ia: number;
  /**
   * `numeric(10,2)` on the table. BE's type says `number`, but `pg` returns
   * `numeric` as a **string** unless a type parser is registered, and
   * `database/kysely.provider.ts` registers none — so `"9.99"` is as likely on
   * the wire as `9.99`. Both are accepted; neither is assumed.
   */
  precio: number | string;
  moneda: string;
  /**
   * Added to `planColumns` on 03/09 for §3.3 of
   * `docs/pedidos-frontend-monetizacion.md`. `integer` on the table with no
   * default, so `null` is both "unlimited" and "nobody set it" — the seed
   * leaves the four legacy plans at `null` and only fills `estudio` and
   * `particular` (`20260821120000_monetizacion_fase1.sql:283-296`).
   */
  max_negotiations_per_period: number | null;
  max_clients_per_period: number | null;
};

/** Thrown when a row cannot be read as a plan — see `toPrice`. */
export const errorPlanPriceUnreadable = 'plan_price_unreadable';

/**
 * A price we cannot read is not a price of zero. Coercing an unparseable
 * `precio` to 0 would render the plan as free — the single worst thing this
 * mapper could do — so it fails the read instead and the screen shows its
 * error state with a retry.
 */
function toPrice(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(errorPlanPriceUnreadable);
    }
    return value;
  }
  // `Number('')` and `Number('  ')` are 0, not NaN — an absent price would
  // have slipped through a bare isFinite check and rendered as free, which is
  // the one outcome this function exists to prevent.
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(errorPlanPriceUnreadable);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(errorPlanPriceUnreadable);
  }
  return parsed;
}

/**
 * Wire row to domain plan. The two coexisting "unlimited" encodings
 * (`null` for `limite_casos` and both period quotas, `-1` for the other two
 * — see `types/plan.ts`)
 * travel through untouched: normalizing them here would hide from the app
 * which convention the row actually uses.
 */
export function toPlan(row: ApiPlan): Plan {
  return {
    id: row.id,
    nombre: row.nombre,
    limiteCarpetas: row.limite_carpetas,
    limiteCasos: row.limite_casos,
    limiteIteracionesIa: row.limite_iteraciones_ia,
    precio: toPrice(row.precio),
    moneda: row.moneda,
    // Straight through, `null` included: it is the "unlimited" encoding of
    // these two columns, and coercing it to a number here would turn an
    // unlimited plan into a plan capped at zero.
    maxNegotiationsPerPeriod: row.max_negotiations_per_period,
    maxClientsPerPeriod: row.max_clients_per_period,
  };
}

export type ApiPlansService = {
  listPlanes(): Promise<Plan[]>;
};

export function createApiPlansService(http: HttpClient): ApiPlansService {
  return {
    // No id in the path and no query: the catalog is the same for everyone,
    // and the endpoint takes no filter. Whatever the table holds is what the
    // app lists — filtering a retired plan out is a job for the source
    // (`docs/pedidos-frontend-monetizacion.md` §5.2), not for this client.
    async listPlanes(): Promise<Plan[]> {
      const rows = await http.request<ApiPlan[]>('/planes');
      return rows.map(toPlan);
    },
  };
}
