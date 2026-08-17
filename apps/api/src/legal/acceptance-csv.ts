import { normalizeTimestamp } from "../common/db/timestamp";
import type { AcceptanceExportRow } from "./legal.types";
import { acceptanceExportColumns } from "./legal.types";

const columnSeparator = ",";
const rowSeparator = "\r\n";
const quotedPattern = /[",\r\n]/;

function escapeCell(value: string): string {
  if (!quotedPattern.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function toCell(row: AcceptanceExportRow, column: string): string {
  if (column === "accepted_at") {
    return escapeCell(normalizeTimestamp(row.accepted_at) ?? "");
  }
  return escapeCell(String(row[column as keyof AcceptanceExportRow] ?? ""));
}

export function buildAcceptancesCsv(rows: AcceptanceExportRow[]): string {
  const header = acceptanceExportColumns.join(columnSeparator);
  const body = rows.map((row) =>
    acceptanceExportColumns
      .map((column) => toCell(row, column))
      .join(columnSeparator),
  );
  return [header, ...body].join(rowSeparator) + rowSeparator;
}
