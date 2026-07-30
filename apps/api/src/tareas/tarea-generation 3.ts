import type { Json } from "@mediacion/db-types";
import type { NewTarea } from "./tareas.types";
import { tipoTareaAccionable } from "./tareas.types";

type MeetingPointEntry = {
  categoria: string;
  punto: number | null;
};

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

function toMeetingPointEntry(value: Json): MeetingPointEntry | undefined {
  const entry = asRecord(value);
  if (!entry) {
    return undefined;
  }
  const { categoria, punto } = entry;
  if (typeof categoria !== "string" || categoria.length === 0) {
    return undefined;
  }
  return { categoria, punto: typeof punto === "number" ? punto : null };
}

function readMeetingPoint(contenido: Json): MeetingPointEntry[] {
  const propuesta = asRecord(asRecord(contenido)?.contenido);
  const entries = propuesta?.meetingPoint;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map(toMeetingPointEntry)
    .filter((entry): entry is MeetingPointEntry => entry !== undefined);
}

function labelFor(categoria: string): string {
  return categoriaLabels[categoria] ?? categoria;
}

function buildDescripcion(entry: MeetingPointEntry): string {
  const label = labelFor(entry.categoria);
  if (entry.punto === null) {
    return `${label} — cumplir lo acordado`;
  }
  return `${label} — punto acordado: ${entry.punto}`;
}

export function buildTareasFromAcuerdo(
  acuerdoId: string,
  casoId: string,
  contenido: Json,
): NewTarea[] {
  return readMeetingPoint(contenido).map((entry) => ({
    acuerdo_id: acuerdoId,
    caso_id: casoId,
    tipo: tipoTareaAccionable,
    descripcion: buildDescripcion(entry),
  }));
}
