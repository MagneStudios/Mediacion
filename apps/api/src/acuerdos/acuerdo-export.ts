import type { Acuerdo } from "./acuerdos.types";

export type AgreementDocumentInput = Pick<
  Acuerdo,
  "id" | "caso_id" | "estado" | "fecha" | "documento_url" | "contenido"
>;

export function agreementDocumentFilename(acuerdoId: string): string {
  return `acuerdo-${acuerdoId}.pdf`;
}
