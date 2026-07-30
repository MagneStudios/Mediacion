import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

type Usuario = Selectable<Database["usuarios"]>;

export type UpdateProfileDto = Partial<
  Pick<Usuario, "nombre" | "apellido" | "telefono" | "idioma">
>;

/**
 * Outcome of an account-deactivation request. Idempotent by contract: a repeat
 * call reports `already_requested` with the ORIGINAL timestamp, never a second
 * record and never a moved date.
 */
export type AccountActionResult =
  | { status: "requested"; requestedAt: string }
  | { status: "already_requested"; requestedAt: string };
