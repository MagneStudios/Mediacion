import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";
import type { UpdateItemDto } from "./items.types";
import { pickUpdatableFields } from "./update-allowlist";

export const ownItemColumns = [
  "id",
  "caso_id",
  "parte_id",
  "categoria",
  "nombre",
  "descripcion",
  "valor_min",
  "valor_max",
  "puede_ceder",
  "condiciones_cesion",
  "privado",
  "created_at",
  "updated_at",
] as const;

export function buildFindOwnQuery(
  db: Kysely<Database>,
  casoId: string,
  callerId: string,
) {
  return db
    .selectFrom("items")
    .select([...ownItemColumns])
    .where("caso_id", "=", casoId)
    .where("parte_id", "=", callerId);
}

export function buildFindOwnByIdQuery(
  db: Kysely<Database>,
  itemId: string,
  callerId: string,
) {
  return db
    .selectFrom("items")
    .select([...ownItemColumns])
    .where("id", "=", itemId)
    .where("parte_id", "=", callerId);
}

export function buildUpdateOwnQuery(
  db: Kysely<Database>,
  itemId: string,
  callerId: string,
  patch: UpdateItemDto,
) {
  return db
    .updateTable("items")
    .set(pickUpdatableFields(patch))
    .where("id", "=", itemId)
    .where("parte_id", "=", callerId)
    .returning([...ownItemColumns]);
}
