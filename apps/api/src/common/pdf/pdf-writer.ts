const pdfVersionHeader = "%PDF-1.4";
const pdfTrailerMarker = "%%EOF";

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

export type PdfPageLayout = {
  pageWidth: number;
  pageHeight: number;
  pageMargin: number;
  fontSize: number;
  lineLeading: number;
};

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

export function escapePdfTextLiteral(value: string): string {
  return toWinAnsiSafe(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildContentStream(lines: string[], layout: PdfPageLayout): string {
  const startY = layout.pageHeight - layout.pageMargin - layout.fontSize;
  const drawn = lines
    .map((line, index) => {
      const command = `(${escapePdfTextLiteral(line)}) Tj`;
      return index === 0 ? command : `T*\n${command}`;
    })
    .join("\n");
  return `BT\n/F1 ${layout.fontSize} Tf\n${layout.lineLeading} TL\n${layout.pageMargin} ${startY} Td\n${drawn}\nET\n`;
}

function buildXref(offsets: number[]): string {
  const freeEntry = `${"0".repeat(xrefEntryWidth)} ${String(freeObjectGeneration).padStart(xrefGenerationWidth, "0")} f \n`;
  const entries = offsets.map(
    (offset) =>
      `${String(offset).padStart(xrefEntryWidth, "0")} ${"0".repeat(xrefGenerationWidth)} n \n`,
  );
  return `xref\n0 ${offsets.length + 1}\n${freeEntry}${entries.join("")}`;
}

/**
 * Monospace Courier over WinAnsi: la única fuente que un lector de PDF tiene
 * garantizada sin incrustarla, y la que hace que una tabla sea texto alineado
 * con `padEnd` en vez de un motor de layout. El costo es que todo se mide en
 * caracteres, no en puntos.
 */
export function renderPdfPages(
  pages: string[][],
  layout: PdfPageLayout,
): Buffer {
  const rendered = pages.length > 0 ? pages : [[""]];
  const pageObjectIds = rendered.map(
    (_page, index) => firstPageObjectId + index * objectsPerPage,
  );
  const bodies = [
    `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${rendered.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  rendered.forEach((lines, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = pageObjectId + 1;
    const stream = buildContentStream(lines, layout);
    bodies.push(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${layout.pageWidth} ${layout.pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
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
