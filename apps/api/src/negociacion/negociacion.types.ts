import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";
import type { MeetingPointEntry } from "./meeting-point";

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

/**
 * `ronda_id` alone tells a client nothing it can render. The round number, the
 * round state and the caller's own decision are what the negotiation screen
 * needs to know whose turn it is, so they travel with each propuesta instead of
 * requiring a separate snapshot endpoint.
 */
export type PropuestaDetail = PropuestaView & {
  ronda_numero: Ronda["numero"];
  ronda_estado: Ronda["estado"];
  own_decision: DecisionPropuesta | null;
};

export type IaConfig = {
  modelo: string;
  temperature: number;
  maxTokens: number;
};

export type PropuestaContenido = {
  meetingPoint: MeetingPointEntry[];
  narrative: string | null;
};

export type RespuestaDto = {
  decision: DecisionPropuesta;
};
