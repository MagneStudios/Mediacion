import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";

/**
 * Serialises "one pending solicitud per caso" on the caso row.
 *
 * There is no partial unique index on `lawyer_requests (caso_id) WHERE status =
 * 'pendiente_pago'`, and under READ COMMITTED two concurrent clicks would both
 * see no pending row and both insert one — leaving the user with two checkouts
 * and the estudio with two charges to reconcile. The lock is what makes the
 * existence check hold; if DB ever adds the partial index, this can become an
 * `onConflict` instead.
 */
export function buildCasoLockQuery(db: Kysely<Database>, casoId: string) {
  return db
    .selectFrom("casos")
    .select("id")
    .where("id", "=", casoId)
    .forUpdate();
}
