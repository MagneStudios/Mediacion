import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type AuthenticatedUser = Pick<
  Selectable<Database["usuarios"]>,
  "id" | "email" | "rol"
>;

export type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};
