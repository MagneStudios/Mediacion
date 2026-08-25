import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type LegalDocument = Selectable<Database["legal_documents"]>;
export type UserAgreement = Selectable<Database["user_agreements"]>;
export type SolicitudArrepentimiento = Selectable<
  Database["solicitudes_arrepentimiento"]
>;
export type SolicitudContacto = Selectable<Database["solicitudes_contacto"]>;

export const documentoTipos = ["terms", "privacy"] as const;

export type DocumentoTipo = (typeof documentoTipos)[number];

export const acuerdoTipos = ["terms", "privacy", "marketing"] as const;

export type AcuerdoTipo = (typeof acuerdoTipos)[number];

export const legalDocumentColumns = [
  "tipo",
  "version",
  "contenido",
  "valid_from",
  "valid_to",
  "is_substantial",
  "resumen_cambios",
] as const;

export type LegalDocumentRow = Pick<
  LegalDocument,
  (typeof legalDocumentColumns)[number]
>;

export type LegalDocumentView = {
  tipo: string;
  version: string;
  contenido: string;
  valid_from: string | null;
  valid_to: string | null;
  is_substantial: boolean;
  resumen_cambios: string | null;
};

export type AceptacionDto = { marketing?: boolean };

export type AceptacionRequestMetadata = { ip: string; userAgent: string };

export type AceptacionStatus = {
  pendientes: DocumentoTipo[];
  requiere_reaceptacion: boolean;
};

export type ArrepentimientoDto = {
  nombre: string;
  email: string;
  detalle: string;
};

export type ContactoDto = { nombre: string; email: string; mensaje: string };

export type SolicitudReceipt = { id: string; received_at: string | null };

export const exportMaxRows = 10000;

export const acceptanceExportColumns = [
  "user_id",
  "document_type",
  "document_version",
  "accepted_at",
  "ip",
  "user_agent",
] as const;

export type AcceptanceExportRow = Pick<
  UserAgreement,
  (typeof acceptanceExportColumns)[number]
>;

export type AcceptanceExportFilters = {
  usuario_id?: string;
  desde?: string;
  hasta?: string;
  document_type?: string;
  version?: string;
};

export type PublicacionProgramada = Pick<
  LegalDocument,
  "tipo" | "version" | "valid_from" | "resumen_cambios"
>;

export type UsuarioActivo = { id: string; email: string };
