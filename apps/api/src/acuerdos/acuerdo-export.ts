import type { Json } from "@mediacion/db-types";
import { normalizeTimestamp } from "../common/db/timestamp";
import type { Acuerdo } from "./acuerdos.types";

export type AgreementDocumentInput = Pick<
  Acuerdo,
  "id" | "caso_id" | "estado" | "fecha" | "documento_url" | "contenido"
>;

const emptyValue = "—";

const categoriaLabels: Record<string, string> = {
  cuidado_ninos: "Cuidado de niños",
  cronogramas: "Cronogramas",
  bienes: "Bienes",
  economico: "Económico",
  personalizado: "Personalizado",
};

function asRecord(value: Json | undefined): Record<string, Json> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, Json>;
}

function readPuntos(contenido: Json): string[] {
  const propuesta = asRecord(asRecord(contenido)?.contenido);
  const entries = propuesta?.meetingPoint;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.flatMap((entry) => {
    const punto = asRecord(entry);
    const categoria = punto?.categoria;
    if (typeof categoria !== "string" || categoria.length === 0) {
      return [];
    }
    const label = categoriaLabels[categoria] ?? categoria;
    const valor = punto?.punto;
    return typeof valor === "number"
      ? [`- ${label}: ${valor}`]
      : [`- ${label}: a definir entre las partes`];
  });
}

function readFundamentacion(contenido: Json): string {
  const fundamentacion = asRecord(contenido)?.fundamentacion;
  return typeof fundamentacion === "string" && fundamentacion.trim().length > 0
    ? fundamentacion
    : emptyValue;
}

export function agreementDocumentFilename(acuerdoId: string): string {
  return `acuerdo-${acuerdoId}.txt`;
}

export function buildAgreementDocument(
  acuerdo: AgreementDocumentInput,
): string {
  const puntos = readPuntos(acuerdo.contenido);
  return [
    "ACUERDO DE MEDIACIÓN",
    "",
    `Identificador: ${acuerdo.id}`,
    `Caso: ${acuerdo.caso_id}`,
    `Estado: ${acuerdo.estado}`,
    `Fecha: ${normalizeTimestamp(acuerdo.fecha) ?? emptyValue}`,
    `Documento firmado: ${acuerdo.documento_url ?? emptyValue}`,
    "",
    "PUNTOS ACORDADOS",
    ...(puntos.length > 0 ? puntos : [emptyValue]),
    "",
    "FUNDAMENTACIÓN",
    readFundamentacion(acuerdo.contenido),
    "",
  ].join("\n");
}
