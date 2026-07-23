import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";

export function buildPropuestaLockQuery(
  db: Kysely<Database>,
  propuestaId: string,
) {
  return db
    .selectFrom("propuestas")
    .select("id")
    .where("id", "=", propuestaId)
    .forUpdate();
}
