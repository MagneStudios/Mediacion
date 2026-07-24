import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Inversor = Selectable<Database["inversores"]>;

export type CreateInversorDto = {
  nombre: string;
  email: string;
  capital_disponible: string;
  experiencia: string;
};

export type InversorResult = Pick<Inversor, "id">;
