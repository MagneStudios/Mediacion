import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Acuerdo = Selectable<Database["acuerdos"]>;
export type Firma = Selectable<Database["firmas"]>;
export type EstadoAcuerdo = Acuerdo["estado"];

export const estadoAcuerdoBorrador: EstadoAcuerdo = "borrador";
export const docusignStatusPending: Firma["docusign_status"] = "pending";

export type Propuesta = Selectable<Database["propuestas"]>;
export type RespuestaPropuesta = Selectable<Database["respuestas_propuesta"]>;
export const estadoPropuestaAceptada: Propuesta["estado"] = "aceptada";

export type PropuestaConRespuestas = {
  propuesta: Propuesta;
  respuestas: RespuestaPropuesta[];
};
