import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Ronda = Selectable<Database["rondas"]>;
export type Propuesta = Selectable<Database["propuestas"]>;
export type RespuestaPropuesta = Selectable<Database["respuestas_propuesta"]>;

export type EstadoPropuesta = Propuesta["estado"];
export type DecisionPropuesta = RespuestaPropuesta["decision"];

export const propuestaViewColumns = [
  "id",
  "caso_id",
  "ronda_id",
  "contenido",
  "fundamentacion",
  "estado",
  "modelo_ia",
  "fecha",
] as const;

export type PropuestaView = Pick<
  Propuesta,
  (typeof propuestaViewColumns)[number]
>;

export type IaConfig = {
  modelo: string;
  temperature: number;
  maxTokens: number;
};
