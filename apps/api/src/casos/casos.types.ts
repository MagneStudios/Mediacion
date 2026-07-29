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

export type CaseSummary = Pick<
  Caso,
  "id" | "nombre" | "estado" | "metodo" | "created_at"
>;

export type CaseDetail = Pick<
  Caso,
  | "id"
  | "nombre"
  | "descripcion"
  | "metodo"
  | "estado"
  | "creador_id"
  | "created_at"
  | "updated_at"
>;

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
