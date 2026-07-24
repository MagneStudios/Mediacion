import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";

export function buildItemLockQuery(
  db: Kysely<Database>,
  itemId: string,
  callerId: string,
) {
  return db
    .selectFrom("items")
    .select("id")
    .where("id", "=", itemId)
    .where("parte_id", "=", callerId)
    .forUpdate();
}
