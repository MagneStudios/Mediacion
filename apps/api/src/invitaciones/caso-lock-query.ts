import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";

export function buildCasoLockQuery(db: Kysely<Database>, casoId: string) {
  return db
    .selectFrom("casos")
    .select("id")
    .where("id", "=", casoId)
    .forUpdate();
}
