import type { Json } from "@mediacion/db-types";
import { normalizeTimestamp } from "../common/db/timestamp";
import { escapePdfTextLiteral, renderPdfPages } from "../common/pdf/pdf-writer";
import type { AgreementDocumentInput } from "./acuerdo-export";

const pageWidth = 595;
const pageHeight = 842;
const pageMargin = 40;
const fontSize = 9;
const lineLeading = 12;
const courierWidthRatio = 0.6;

const charsPerLine = Math.floor(
  (pageWidth - pageMargin * 2) / (fontSize * courierWidthRatio),
);
const linesPerPage = Math.floor((pageHeight - pageMargin * 2) / lineLeading);

const emptyValue = "—";
const documentTitle = "ACUERDO DE MEDIACIÓN";

const categoriaLabels: Record<string, string> = {
  cuidado_ninos: "Cuidado de niños",
  cronogramas: "Cronogramas",
  bienes: "Bienes",
  economico: "Económico",
  personalizado: "Personalizado",
};

const diaLabels: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

const categoriaColumnWidth = 28;
const valorColumnWidth = 28;
const diaColumnWidth = 11;
const horarioColumnWidth = 15;
const actividadColumnWidth = 26;
const aCargoColumnWidth = 20;
const columnGap = "  ";
const truncationMarker = "~";

function asRecord(value: Json | undefined): Record<string, Json> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, Json>;
}

function asText(value: Json | undefined): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function pad(value: string, width: number): string {
  if (value.length <= width) {
    return value.padEnd(width);
  }
  return `${value.slice(0, width - truncationMarker.length)}${truncationMarker}`;
}

function rule(width: number): string {
  return "-".repeat(Math.min(width, charsPerLine));
}

function wrap(value: string, width: number): string[] {
  if (value.length === 0) {
    return [""];
  }
  const lines: string[] = [];
  let line = "";
  let drawnWidth = 0;
  for (const word of value.split(/\s+/)) {
    const wordWidth = escapePdfTextLiteral(word).length;
    if (drawnWidth > 0 && drawnWidth + 1 + wordWidth > width) {
      lines.push(line);
      line = "";
      drawnWidth = 0;
    }
    if (drawnWidth > 0) {
      line += " ";
      drawnWidth += 1;
    }
    line += word;
    drawnWidth += wordWidth;
  }
  if (line.length > 0) {
    lines.push(line);
  }
  return lines;
}

function section(title: string): string[] {
  return ["", title, rule(title.length)];
}

function buildHeader(acuerdo: AgreementDocumentInput): string[] {
  return [
    documentTitle,
    rule(documentTitle.length),
    `Identificador: ${acuerdo.id}`,
    `Caso:          ${acuerdo.caso_id}`,
    `Estado:        ${acuerdo.estado}`,
    `Fecha:         ${normalizeTimestamp(acuerdo.fecha) ?? emptyValue}`,
  ];
}

function buildPuntosTable(contenido: Json): string[] {
  const propuesta = asRecord(asRecord(contenido)?.contenido);
  const entries = propuesta?.meetingPoint;
  const rows = Array.isArray(entries)
    ? entries.flatMap((entry) => {
        const punto = asRecord(entry);
        const categoria = asText(punto?.categoria);
        if (categoria.length === 0) {
          return [];
        }
        const label = categoriaLabels[categoria] ?? categoria;
        const valor = punto?.punto;
        return [
          `${pad(label, categoriaColumnWidth)}${columnGap}${pad(
            typeof valor === "number"
              ? String(valor)
              : "a definir entre las partes",
            valorColumnWidth,
          )}`,
        ];
      })
    : [];
  return [
    ...section("PUNTOS ACORDADOS"),
    `${pad("Categoría", categoriaColumnWidth)}${columnGap}${pad("Valor", valorColumnWidth)}`,
    rule(categoriaColumnWidth + columnGap.length + valorColumnWidth),
    ...(rows.length > 0 ? rows : [emptyValue]),
  ];
}

/**
 * El cronograma va adentro del contrato, no en un anexo (`CAMBIOS-PACTUM-v2`
 * §10). La fuente es la ficha de contexto del caso, que todavía no existe como
 * modelo de datos: hasta que exista, `contenido.cronograma` llega vacío y la
 * sección lo dice en lugar de dibujar una tabla en blanco. La forma que se lee
 * acá es el contrato que esa ficha tiene que producir.
 */
function buildCronogramaTable(contenido: Json): string[] {
  const propuesta = asRecord(asRecord(contenido)?.contenido);
  const entries = propuesta?.cronograma;
  const rows = Array.isArray(entries)
    ? entries.flatMap((entry) => {
        const tramo = asRecord(entry);
        const dia = asText(tramo?.dia);
        if (dia.length === 0) {
          return [];
        }
        const desde = asText(tramo?.desde);
        const hasta = asText(tramo?.hasta);
        const horario =
          desde.length > 0 && hasta.length > 0
            ? `${desde} a ${hasta}`
            : desde || hasta || emptyValue;
        return [
          [
            pad(diaLabels[dia] ?? dia, diaColumnWidth),
            pad(horario, horarioColumnWidth),
            pad(asText(tramo?.actividad) || emptyValue, actividadColumnWidth),
            pad(asText(tramo?.a_cargo) || emptyValue, aCargoColumnWidth),
          ].join(columnGap),
        ];
      })
    : [];
  if (rows.length === 0) {
    return [...section("CRONOGRAMA"), "Sin cronograma cargado para este caso."];
  }
  return [
    ...section("CRONOGRAMA"),
    [
      pad("Día", diaColumnWidth),
      pad("Horario", horarioColumnWidth),
      pad("Actividad", actividadColumnWidth),
      pad("A cargo", aCargoColumnWidth),
    ].join(columnGap),
    rule(charsPerLine),
    ...rows,
  ];
}

function buildFundamentacion(contenido: Json): string[] {
  const fundamentacion = asText(asRecord(contenido)?.fundamentacion);
  return [
    ...section("FUNDAMENTACIÓN"),
    ...(fundamentacion.length > 0
      ? wrap(fundamentacion, charsPerLine)
      : [emptyValue]),
  ];
}

function buildCierre(acuerdo: AgreementDocumentInput): string[] {
  const respuestas = asRecord(acuerdo.contenido)?.respuestas;
  const rows = Array.isArray(respuestas)
    ? respuestas.flatMap((entry) => {
        const respuesta = asRecord(entry);
        const parte = asText(respuesta?.parte_id);
        if (parte.length === 0) {
          return [];
        }
        const decision = asText(respuesta?.decision) || emptyValue;
        const fecha = normalizeTimestamp(respuesta?.fecha) ?? emptyValue;
        return [
          `${pad(parte, 38)}${columnGap}${pad(decision, 12)}${columnGap}${fecha}`,
        ];
      })
    : [];
  return [
    ...section("CIERRE"),
    "Conformidad de las partes:",
    ...(rows.length > 0 ? rows : [emptyValue]),
    "",
    `Documento firmado: ${acuerdo.documento_url ?? emptyValue}`,
  ];
}

function paginate(lines: string[]): string[][] {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  return pages.length > 0 ? pages : [[""]];
}

export function buildAgreementPdf(acuerdo: AgreementDocumentInput): Buffer {
  const lines = [
    ...buildHeader(acuerdo),
    ...buildPuntosTable(acuerdo.contenido),
    ...buildCronogramaTable(acuerdo.contenido),
    ...buildFundamentacion(acuerdo.contenido),
    ...buildCierre(acuerdo),
  ];
  return renderPdfPages(paginate(lines), {
    pageWidth,
    pageHeight,
    pageMargin,
    fontSize,
    lineLeading,
  });
}
