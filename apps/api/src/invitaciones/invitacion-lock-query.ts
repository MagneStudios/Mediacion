import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";

export function buildInvitacionLockQuery(
  db: Kysely<Database>,
  invitacionId: string,
  casoId: string,
) {
  return db
    .selectFrom("invitaciones")
    .select(["id", "tipo", "token", "estado", "email_destino", "pago_a_cargo"])
    .where("id", "=", invitacionId)
    .where("caso_id", "=", casoId)
    .forUpdate();
}
