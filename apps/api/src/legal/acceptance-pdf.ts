import { normalizeTimestamp } from "../common/db/timestamp";
import { escapePdfTextLiteral, renderPdfPages } from "../common/pdf/pdf-writer";
import type { AcceptanceExportRow } from "./legal.types";
import { acceptanceExportColumns } from "./legal.types";

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

const escapeTextLiteral = escapePdfTextLiteral;

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

export function buildAcceptancesPdf(rows: AcceptanceExportRow[]): Buffer {
  const headerLines = buildHeaderLines();
  const linesPerPage =
    Math.floor((pageHeight - pageMargin * 2) / lineLeading) -
    headerLines.length;
  const groups =
    rows.length === 0 ? [[emptyLogNotice]] : rows.map(buildRowLines);
  const pages = paginate(groups, linesPerPage);

  return renderPdfPages(
    pages.map((bodyLines) => [...headerLines, ...bodyLines]),
    { pageWidth, pageHeight, pageMargin, fontSize, lineLeading },
  );
}
