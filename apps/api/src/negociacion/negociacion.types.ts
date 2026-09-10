import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";
import type { MeetingPointEntry } from "./meeting-point";

export type Ronda = Selectable<Database["rondas"]>;
export type Propuesta = Selectable<Database["propuestas"]>;
export type RespuestaPropuesta = Selectable<Database["respuestas_propuesta"]>;
export type Negociacion = Selectable<Database["negociaciones"]>;
export type Acuerdo = Selectable<Database["acuerdos"]>;

export type EstadoPropuesta = Propuesta["estado"];
export type DecisionPropuesta = RespuestaPropuesta["decision"];
export type EstadoNegociacion = Negociacion["estado"];
export type MateriaAcuerdo = NonNullable<Negociacion["materia"]>;
export type MetodoCaso = Negociacion["method"];

/**
 * The materia's own agreed state, and what gates generating its acuerdo. It is
 * the caso's `acordado` that is derived from these — never the other way
 * around: a caso is agreed once every one of its negociaciones is.
 */
export const estadoNegociacionAcordada: EstadoNegociacion = "acordada";

/** Where a renegotiation puts the materia back. */
export const estadoNegociacionActiva: EstadoNegociacion = "activa";

/** The default the schema gives a negociacion until it is actually negotiated. */
export const estadoNegociacionBorrador: EstadoNegociacion = "borrador";

/**
 * Every materia a caller may open a negociacion for. Declared here rather than
 * derived at runtime — there is no reflection over a Postgres enum — and
 * guarded by a compile spec that fails `tsc` if `materia_acuerdo` ever grows
 * past it, so a new materia cannot be silently rejected as `invalid_input`.
 */
export const materiasAcuerdo = [
  "tenencia",
  "alimentos",
  "bienes",
  "otro",
] as const;

/**
 * The acuerdo currently in force for a negociacion. Null — never an object with
 * empty fields — when the negociacion has not produced one yet: "no agreement"
 * and "a draft agreement" drive different buttons on the case screen.
 */
export type AcuerdoVigenteView = {
  id: Acuerdo["id"];
  estado: Acuerdo["estado"];
  version: Acuerdo["version"];
};

/**
 * One negociacion of a caso. Three field names differ from their columns on
 * purpose: the wire already speaks `subject_type` (the signature inbox),
 * `metodo` and `ronda_actual` (GET /casos), and one name per concept across the
 * API is what lets the client reuse a single mapper.
 *
 * `subject_type` is null for a negociacion carried over from the one-agreement
 * model — never `'otro'`, which is a real materia a user can choose.
 */
export type NegociacionView = {
  id: Negociacion["id"];
  caso_id: Negociacion["caso_id"];
  subject_type: MateriaAcuerdo | null;
  metodo: Negociacion["method"];
  estado: EstadoNegociacion;
  ronda_actual: Negociacion["round"];
  acuerdo_vigente: AcuerdoVigenteView | null;
  created_at: Negociacion["created_at"];
};

/**
 * The frozen §2.4 shape: the negociacion that reopened and the draft that is
 * now its starting point. Deliberately nothing else — the client re-reads
 * `GET /casos/:id/negociaciones` for the rest.
 */
export type RenegociacionView = {
  negotiation_id: Negociacion["id"];
  agreement_id: Acuerdo["id"];
};

export const propuestaViewColumns = [
  "id",
  "caso_id",
  "negociacion_id",
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

/**
 * The body of the alta route. `subject_type` is the wire name the signature
 * inbox and `NegociacionView` already use for `negociaciones.materia`, and it
 * is required: the materia-less negociacion is created by `POST /casos`, and
 * letting a client post a second one would give the caso two rows that no
 * materia tells apart.
 */
export type CreateNegociacionDto = {
  subject_type: MateriaAcuerdo;
};
