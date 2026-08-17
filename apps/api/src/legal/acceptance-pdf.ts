import { normalizeTimestamp } from "../common/db/timestamp";
import type { AcceptanceExportRow } from "./legal.types";
import { acceptanceExportColumns } from "./legal.types";

const pdfVersionHeader = "%PDF-1.4";
const pdfTrailerMarker = "%%EOF";
const pageWidth = 842;
const pageHeight = 595;
const pageMargin = 28;
const fontSize = 8;
const lineLeading = 10;
const courierWidthRatio = 0.6;
const charsPerLine = Math.floor(
  (pageWidth - pageMargin * 2) / (fontSize * courierWidthRatio),
);
const documentTitle = "Registro de aceptaciones - Proyecto Mediacion";
const columnGap = "  ";
const userIdWidth = 36;
const documentTypeWidth = 13;
const documentVersionWidth = 10;
const acceptedAtWidth = 24;
const ipWidth = 15;
const userAgentLabel = "    user_agent: ";
const userAgentContinuation = "                ";
const emptyLogNotice = "Sin aceptaciones para los filtros aplicados.";

const catalogObjectId = 1;
const pagesObjectId = 2;
const fontObjectId = 3;
const firstPageObjectId = 4;
const objectsPerPage = 2;

const xrefEntryWidth = 10;
const xrefGenerationWidth = 5;
const freeObjectGeneration = 65535;

const latin1MaxCodePoint = 0xff;
const controlCharMaxCodePoint = 0x1f;
const replacementChar = "?";

function toWinAnsiSafe(value: string): string {
  let safe = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= controlCharMaxCodePoint) {
      safe += " ";
      continue;
    }
    safe += codePoint > latin1MaxCodePoint ? replacementChar : char;
  }
  return safe;
}

function escapeTextLiteral(value: string): string {
  return toWinAnsiSafe(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// ASCII on purpose: anything outside WinAnsi would itself be replaced by "?".
const truncationMarker = "~";

function pad(value: string, width: number): string {
  if (value.length <= width) {
    return value.padEnd(width);
  }
  return `${value.slice(0, width - truncationMarker.length)}${truncationMarker}`;
}

function wrap(value: string, width: number): string[] {
  if (value.length === 0) {
    return [""];
  }
  const chunks: string[] = [];
  let chunk = "";
  let drawnWidth = 0;
  for (const char of value) {
    // Measured on the ESCAPED length, because that is what ends up on the
    // page: a backslash or a parenthesis becomes two characters. Wrapping on
    // the raw length let a user_agent of 147 backslashes render 294 characters
    // wide on an 842pt page — everything past ~163 drawn outside the MediaBox
    // and invisible in any reader. Silent visual truncation of evidence.
    const charWidth = escapeTextLiteral(char).length;
    if (drawnWidth + charWidth > width && chunk.length > 0) {
      chunks.push(chunk);
      chunk = "";
      drawnWidth = 0;
    }
    chunk += char;
    drawnWidth += charWidth;
  }
  if (chunk.length > 0) {
    chunks.push(chunk);
  }
  return chunks;
}

function cell(row: AcceptanceExportRow, column: string): string {
  if (column === "accepted_at") {
    return normalizeTimestamp(row.accepted_at) ?? "";
  }
  return String(row[column as keyof AcceptanceExportRow] ?? "");
}

const wrappedColumn = "user_agent";

type ExportColumn = (typeof acceptanceExportColumns)[number];
type TabularColumn = Exclude<ExportColumn, typeof wrappedColumn>;

const columnWidths: Record<TabularColumn, number> = {
  user_id: userIdWidth,
  document_type: documentTypeWidth,
  document_version: documentVersionWidth,
  accepted_at: acceptedAtWidth,
  ip: ipWidth,
};

const tabularColumns: readonly TabularColumn[] = acceptanceExportColumns.filter(
  (column): column is TabularColumn => column !== wrappedColumn,
);

function buildHeaderLines(): string[] {
  return [
    documentTitle,
    `columnas: ${acceptanceExportColumns.join(", ")}`,
    tabularColumns
      .map((column) => pad(column, columnWidths[column]))
      .join(columnGap),
  ];
}

function buildRowLines(row: AcceptanceExportRow): string[] {
  const fixed = tabularColumns
    .map((column) => pad(cell(row, column), columnWidths[column]))
    .join(columnGap);
  const userAgentChunks = wrap(
    cell(row, wrappedColumn),
    charsPerLine - userAgentLabel.length,
  );
  const [first, ...rest] = userAgentChunks;
  return [
    fixed,
    `${userAgentLabel}${first}`,
    ...rest.map((chunk) => `${userAgentContinuation}${chunk}`),
  ];
}

function paginate(groups: string[][], linesPerPage: number): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  for (const group of groups) {
    // An acceptance stays whole on one page whenever it fits, so its
    // user_agent is never separated from the row it belongs to.
    if (group.length <= linesPerPage) {
      if (current.length > 0 && current.length + group.length > linesPerPage) {
        pages.push(current);
        current = [];
      }
      current.push(...group);
      continue;
    }
    // It does not fit: split by line across pages. user_agent is unbounded
    // TEXT and Node accepts headers up to 16KB, so one acceptance can wrap
    // past a page. Pushing it whole drew its tail at a negative y — off the
    // MediaBox, invisible in every reader. Losing the page break is bad;
    // losing the evidence is worse.
    if (current.length > 0) {
      pages.push(current);
      current = [];
    }
    for (const line of group) {
      if (current.length === linesPerPage) {
        pages.push(current);
        current = [];
      }
      current.push(line);
    }
  }
  if (current.length > 0) {
    pages.push(current);
  }
  return pages;
}

function buildContentStream(
  headerLines: string[],
  bodyLines: string[],
): string {
  const lines = [...headerLines, ...bodyLines];
  const startY = pageHeight - pageMargin - fontSize;
  const drawn = lines
    .map((line, index) => {
      const command = `(${escapeTextLiteral(line)}) Tj`;
      return index === 0 ? command : `T*\n${command}`;
    })
    .join("\n");
  return `BT\n/F1 ${fontSize} Tf\n${lineLeading} TL\n${pageMargin} ${startY} Td\n${drawn}\nET\n`;
}

function buildXref(offsets: number[]): string {
  const freeEntry = `${"0".repeat(xrefEntryWidth)} ${String(freeObjectGeneration).padStart(xrefGenerationWidth, "0")} f \n`;
  const entries = offsets.map(
    (offset) =>
      `${String(offset).padStart(xrefEntryWidth, "0")} ${"0".repeat(xrefGenerationWidth)} n \n`,
  );
  return `xref\n0 ${offsets.length + 1}\n${freeEntry}${entries.join("")}`;
}

export function buildAcceptancesPdf(rows: AcceptanceExportRow[]): Buffer {
  const headerLines = buildHeaderLines();
  const linesPerPage =
    Math.floor((pageHeight - pageMargin * 2) / lineLeading) -
    headerLines.length;
  const groups =
    rows.length === 0 ? [[emptyLogNotice]] : rows.map(buildRowLines);
  const pages = paginate(groups, linesPerPage);

  const pageObjectIds = pages.map(
    (_page, index) => firstPageObjectId + index * objectsPerPage,
  );
  const bodies = [
    `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  pages.forEach((bodyLines, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = pageObjectId + 1;
    const stream = buildContentStream(headerLines, bodyLines);
    bodies.push(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    bodies.push(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
    );
  });

  let document = `${pdfVersionHeader}\n`;
  const offsets: number[] = [];
  bodies.forEach((body, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = document.length;
  document += buildXref(offsets);
  document += `trailer\n<< /Size ${bodies.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n${pdfTrailerMarker}\n`;

  return Buffer.from(document, "latin1");
}
