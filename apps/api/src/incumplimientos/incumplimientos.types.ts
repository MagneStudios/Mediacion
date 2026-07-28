import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Incumplimiento = Selectable<Database["incumplimientos"]>;

export const incumplimientoViewColumns = [
  "id",
  "acuerdo_id",
  "reportante_id",
  "descripcion",
  "fecha",
  "created_at",
] as const;

export type IncumplimientoView = Pick<
  Incumplimiento,
  (typeof incumplimientoViewColumns)[number]
>;

export type RegisterIncumplimientoDto = {
  descripcion: string;
};

export type AcuerdoForBreach = Pick<
  Selectable<Database["acuerdos"]>,
  "id" | "caso_id" | "estado"
>;
