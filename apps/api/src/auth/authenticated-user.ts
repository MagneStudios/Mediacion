import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type AuthenticatedUser = Pick<
  Selectable<Database["usuarios"]>,
  "id" | "email" | "rol"
>;

export type RolUsuario = AuthenticatedUser["rol"];

export type MeProfile = Pick<
  Selectable<Database["usuarios"]>,
  | "id"
  | "rol"
  | "nombre"
  | "apellido"
  | "email"
  | "telefono"
  | "idioma"
  | "verif_biometrica"
  | "estudio_id"
  | "activo"
>;

export type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};
