import { normalizeTimestamp } from "../common/db/timestamp";
import type { PublicacionProgramada } from "./legal.types";

const millisecondsPerDay = 86_400_000;

const nombrePorTipo: Record<string, string> = {
  terms: "Términos y Condiciones",
  privacy: "Política de Privacidad",
};

export function buildAvisoEvento(publicacion: PublicacionProgramada): string {
  const nombre = nombrePorTipo[publicacion.tipo] ?? publicacion.tipo;
  const vigencia = normalizeTimestamp(publicacion.valid_from) ?? "";
  const resumen = publicacion.resumen_cambios
    ? ` Qué cambia: ${publicacion.resumen_cambios}`
    : "";
  return `Actualizamos nuestros ${nombre}: la versión ${publicacion.version} entra en vigencia el ${vigencia}.${resumen}`;
}

export function diasDeAnticipacion(
  publicacion: PublicacionProgramada,
  now: Date,
): number | null {
  const validFrom = normalizeTimestamp(publicacion.valid_from);
  if (!validFrom) {
    return null;
  }
  return (new Date(validFrom).getTime() - now.getTime()) / millisecondsPerDay;
}
