import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Acuerdo = Selectable<Database["acuerdos"]>;
export type Firma = Selectable<Database["firmas"]>;
export type EstadoAcuerdo = Acuerdo["estado"];

export const estadoAcuerdoBorrador: EstadoAcuerdo = "borrador";
export const estadoAcuerdoEnviadoAFirma: EstadoAcuerdo = "enviado_a_firma";
export const estadoAcuerdoFirmado: EstadoAcuerdo = "firmado";
export const estadoAcuerdoConAviso: EstadoAcuerdo = "con_aviso";
export const docusignStatusPending: Firma["docusign_status"] = "pending";
export const docusignStatusSent: Firma["docusign_status"] = "sent";
export const docusignStatusDelivered: Firma["docusign_status"] = "delivered";
export const docusignStatusSigned: Firma["docusign_status"] = "signed";
export const docusignStatusDeclined: Firma["docusign_status"] = "declined";
export const docusignStatusVoided: Firma["docusign_status"] = "voided";

export type Propuesta = Selectable<Database["propuestas"]>;
export type RespuestaPropuesta = Selectable<Database["respuestas_propuesta"]>;
export const estadoPropuestaAceptada: Propuesta["estado"] = "aceptada";

export type AcuerdoExport = {
  filename: string;
  document: string;
};

export type PropuestaConRespuestas = {
  propuesta: Propuesta;
  respuestas: RespuestaPropuesta[];
};

/** Per-signer state for one acuerdo, as a member of the caso sees it. */
export type FirmaView = {
  usuario_id: string;
  nombre: string;
  apellido: string;
  docusign_status: string;
  fecha_firma: string | null;
};

/** One row of the signature inbox: an acuerdo plus this caller's own state. */
export type SignatureInboxEntry = {
  acuerdo_id: string;
  caso_id: string;
  caso_nombre: string;
  caso_codigo: string | null;
  acuerdo_estado: string;
  own_status: string;
  own_fecha_firma: string | null;
  pending_signers: number;
};
