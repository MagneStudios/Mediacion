import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Acuerdo = Selectable<Database["acuerdos"]>;
export type Firma = Selectable<Database["firmas"]>;
export type EstadoAcuerdo = Acuerdo["estado"];

export const estadoAcuerdoBorrador: EstadoAcuerdo = "borrador";
export const estadoAcuerdoEnviadoAFirma: EstadoAcuerdo = "enviado_a_firma";
export const estadoAcuerdoFirmado: EstadoAcuerdo = "firmado";
export const docusignStatusPending: Firma["docusign_status"] = "pending";
export const docusignStatusSent: Firma["docusign_status"] = "sent";
export const docusignStatusDelivered: Firma["docusign_status"] = "delivered";
export const docusignStatusSigned: Firma["docusign_status"] = "signed";
export const docusignStatusDeclined: Firma["docusign_status"] = "declined";
export const docusignStatusVoided: Firma["docusign_status"] = "voided";

export type Propuesta = Selectable<Database["propuestas"]>;
export type RespuestaPropuesta = Selectable<Database["respuestas_propuesta"]>;
export const estadoPropuestaAceptada: Propuesta["estado"] = "aceptada";

export type PropuestaConRespuestas = {
  propuesta: Propuesta;
  respuestas: RespuestaPropuesta[];
};
