import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Caso = Selectable<Database["casos"]>;
export type CasoParte = Selectable<Database["caso_partes"]>;
export type MetodoCaso = Caso["metodo"];

export type CreateCasoDto = {
  nombre: string;
  descripcion?: string | null;
  metodo: MetodoCaso;
};

export type CaseCreated = Pick<Caso, "id" | "estado">;

export type CasoParteMembership = Pick<
  CasoParte,
  "id" | "caso_id" | "usuario_id" | "rol_en_caso" | "estado_invitacion"
>;

export const estadoInvitacionAceptada: CasoParte["estado_invitacion"] =
  "aceptada";

/** The other accepted parte of a caso, from the caller's point of view. */
export type Contraparte = Pick<CasoParte, "usuario_id" | "rol_en_caso"> & {
  nombre: string;
  apellido: string;
};

export type ContraparteByCaso = Contraparte & Pick<CasoParte, "caso_id">;

export const rolesParte: CasoParte["rol_en_caso"][] = ["parte_a", "parte_b"];

export type CaseSummaryRow = Pick<
  Caso,
  | "id"
  | "codigo"
  | "nombre"
  | "estado"
  | "metodo"
  | "created_at"
  | "plazo"
  | "sla_tipo"
  | "ronda_actual"
>;

export type CaseDetailRow = Pick<
  Caso,
  | "id"
  | "codigo"
  | "nombre"
  | "descripcion"
  | "metodo"
  | "estado"
  | "creador_id"
  | "created_at"
  | "updated_at"
  | "plazo"
  | "sla_tipo"
  | "ronda_actual"
>;

/**
 * The dashboard renders the semaforo and the counterparty label from these, so
 * they travel with the caso instead of forcing a request per card.
 */
export type CaseSummary = CaseSummaryRow & {
  semaforo: Semaforo | null;
  contraparte: Contraparte | null;
};

export type CaseDetail = CaseDetailRow & {
  semaforo: Semaforo | null;
  contraparte: Contraparte | null;
};

export type EstadoCaso = Caso["estado"];

export const estadoCasoTerminado: EstadoCaso = "terminado";

export type EstadoCasoDto = {
  estado: EstadoCaso;
};

export type CaseEstado = Pick<Caso, "id" | "estado">;

export type Semaforo = "verde" | "amarillo" | "rojo";

export type PlazoDto = {
  plazo: string;
};

export type PlazoState = {
  id: Caso["id"];
  plazo: Caso["plazo"];
  semaforo: Semaforo | null;
};
