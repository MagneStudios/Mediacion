import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

type Usuario = Selectable<Database["usuarios"]>;

export type UpdateProfileDto = Partial<
  Pick<Usuario, "nombre" | "apellido" | "telefono" | "idioma">
>;
