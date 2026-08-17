import { buildAcceptancesPdf } from "./acceptance-pdf";
import type { AcceptanceExportRow } from "./legal.types";

const row: AcceptanceExportRow = {
  user_id: "3f1c9f6e-2b7a-4d1e-8a55-9c0f1b2d3e4f",
  document_type: "terms",
  document_version: "v1.0",
  accepted_at: "2026-08-14T15:02:00.000Z",
  ip: "203.0.113.7",
  user_agent: "Expo/1.0",
};

function asText(rows: AcceptanceExportRow[]): string {
  return buildAcceptancesPdf(rows).toString("latin1");
}

function readStartxref(pdf: string): number {
  const marker = "startxref\n";
  const start = pdf.lastIndexOf(marker) + marker.length;
  return Number(pdf.slice(start, pdf.indexOf("\n", start)));
}

function readXrefOffsets(pdf: string): number[] {
  return pdf
    .slice(readStartxref(pdf))
    .split("\n")
    .filter((line) => line.endsWith(" n "))
    .map((line) => Number(line.slice(0, 10)));
}

const charsPerLineForTest = 163;
const lineLeadingForTest = 10;

/** The text literals the content stream actually draws, in order. */
function drawnLines(pdf: string): string[] {
  return [...pdf.matchAll(/\((.*?)\) Tj/g)].map((match) => match[1]);
}

function manyRows(count: number): AcceptanceExportRow[] {
  return Array.from({ length: count }, (_entry, index) => ({
    ...row,
    document_version: `v1.${index}`,
  }));
}

describe("buildAcceptancesPdf", () => {
  it("emits a syntactically complete PDF with a catalog and a trailer", () => {
    const pdf = asText([row]);

    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("/Type /Pages");
    expect(pdf).toContain("/Type /Page ");
    expect(pdf).toContain("/BaseFont /Courier");
  });

  it("points startxref at the byte offset where the xref table actually starts", () => {
    const pdf = asText([row]);

    expect(pdf.slice(readStartxref(pdf), readStartxref(pdf) + 4)).toBe("xref");
  });

  // Every structural assertion runs over a MULTI-page document and over EVERY
  // object and EVERY stream. Checking only the first of each let a corrupted
  // offset on page 2 pass while a real reader hard-failed with
  // "Unable to find 'endstream' marker after stream".
  it.each([[1], [60], [200]])(
    "points every xref entry at the byte offset of its own object (%i rows)",
    (count) => {
      const pdf = asText(manyRows(count));
      const offsets = readXrefOffsets(pdf);

      expect(offsets.length).toBeGreaterThan(3);
      offsets.forEach((offset, index) => {
        expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(
          `${index + 1} 0 obj`,
        );
      });
    },
  );

  it("lists exactly one xref entry per object in the document", () => {
    const pdf = asText(manyRows(60));
    const objectCount = pdf.match(/^\d+ 0 obj$/gm)?.length ?? 0;

    expect(readXrefOffsets(pdf)).toHaveLength(objectCount);
    expect(pdf).toContain(`/Size ${objectCount + 1}`);
  });

  it.each([[1], [60], [200]])(
    "declares a stream length that matches the bytes actually written, on every page (%i rows)",
    (count) => {
      const pdf = asText(manyRows(count));
      const declared = [...pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)];

      expect(declared.length).toBeGreaterThan(0);
      for (const match of declared) {
        const streamStart = (match.index ?? 0) + match[0].length;
        const streamEnd = pdf.indexOf("endstream", streamStart);
        expect(
          Buffer.byteLength(pdf.slice(streamStart, streamEnd), "latin1"),
        ).toBe(Number(match[1]));
      }
    },
  );

  it("declares one content stream per page", () => {
    const pdf = asText(manyRows(60));
    const pageCount = Number(/\/Count (\d+)/.exec(pdf)?.[1]);

    expect(pdf.match(/<< \/Length \d+ >>\nstream\n/g)).toHaveLength(pageCount);
  });

  it("names the six columns the instructivo demands", () => {
    const pdf = asText([row]);

    expect(pdf).toContain(
      "columnas: user_id, document_type, document_version, accepted_at, ip, user_agent",
    );
  });

  it("keeps the title readable in WinAnsi instead of degrading it to question marks", () => {
    const pdf = asText([row]);

    expect(pdf).toContain("Registro de aceptaciones - Proyecto Mediacion");
    expect(pdf).not.toContain("Registro de aceptaciones ?");
  });

  it("writes every field of an acceptance, the user agent included", () => {
    const pdf = asText([row]);

    expect(pdf).toContain("3f1c9f6e-2b7a-4d1e-8a55-9c0f1b2d3e4f");
    expect(pdf).toContain("terms");
    expect(pdf).toContain("v1.0");
    expect(pdf).toContain("2026-08-14T15:02:00.000Z");
    expect(pdf).toContain("203.0.113.7");
    expect(pdf).toContain("user_agent: Expo/1.0");
  });

  it("normalizes the Date the driver returns for accepted_at", () => {
    const pdf = asText([
      {
        ...row,
        accepted_at: new Date("2026-08-14T15:02:00.000Z") as unknown as string,
      },
    ]);

    expect(pdf).toContain("2026-08-14T15:02:00.000Z");
  });

  it("escapes the parentheses and backslashes a user agent can carry", () => {
    const pdf = asText([
      { ...row, user_agent: "Mozilla/5.0 (X11; Linux) back\\slash" },
    ]);

    expect(pdf).toContain("Mozilla/5.0 \\(X11; Linux\\) back\\\\slash");
  });

  it("wraps a long user agent instead of losing evidence", () => {
    const longAgent = `Mozilla/5.0 ${"Q".repeat(400)}`;
    const pdf = asText([{ ...row, user_agent: longAgent }]);
    const written = pdf
      .match(/Q+/g)
      ?.reduce((total, run) => total + run.length, 0);

    expect(pdf).not.toContain("Q".repeat(200));
    expect(written).toBe(400);
  });

  it("replaces a character outside WinAnsi so the byte offsets stay honest", () => {
    // `byteLength(s, "latin1") === s.length` is a theorem for any latin1
    // string, so asserting it proves nothing. What "the offsets stay honest"
    // actually means is that the xref still resolves with such a row in it.
    const pdf = asText([
      { ...row, user_agent: "cliente 東京" },
      ...manyRows(60),
    ]);

    expect(pdf).toContain("cliente ??");
    readXrefOffsets(pdf).forEach((offset, index) => {
      expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(
        `${index + 1} 0 obj`,
      );
    });
  });

  it("still produces a valid one-page document when the log is empty", () => {
    const pdf = asText([]);

    expect(pdf).toContain("/Count 1");
    expect(pdf).toContain("Sin aceptaciones para los filtros aplicados.");
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
  });

  it("breaks into more than one page once the rows stop fitting", () => {
    const rows = Array.from({ length: 60 }, (_entry, index) => ({
      ...row,
      document_version: `v1.${index}`,
    }));
    const pdf = asText(rows);
    const pageCount = Number(/\/Count (\d+)/.exec(pdf)?.[1]);

    expect(pageCount).toBeGreaterThan(1);
    expect(pdf.match(/\/Type \/Page /g)?.length).toBe(pageCount);
  });

  it("repeats the column header on every page", () => {
    const rows = Array.from({ length: 60 }, () => row);
    const pdf = asText(rows);
    const pageCount = Number(/\/Count (\d+)/.exec(pdf)?.[1]);

    expect(pdf.match(/columnas: user_id/g)?.length).toBe(pageCount);
  });

  it("wraps on the escaped width, so an agent full of backslashes still fits the page", () => {
    // A backslash is two characters once escaped. Wrapping on the raw length
    // drew 294 characters on a page that holds 163: everything past the margin
    // fell outside the MediaBox and was invisible in any reader.
    const pdf = asText([{ ...row, user_agent: "\\".repeat(300) }]);

    for (const line of drawnLines(pdf)) {
      expect(line.length).toBeLessThanOrEqual(charsPerLineForTest);
    }
    expect(pdf.match(/\\\\/g)?.length).toBe(300);
  });

  it("splits an acceptance whose user agent alone overflows a page", () => {
    // user_agent is unbounded TEXT and Node accepts headers up to 16KB, so one
    // row can need more than a page. It used to be pushed whole, drawing its
    // tail at a negative y.
    const pdf = asText([{ ...row, user_agent: "Q".repeat(20_000) }]);
    const pageCount = Number(/\/Count (\d+)/.exec(pdf)?.[1]);

    expect(pageCount).toBeGreaterThan(1);
    expect(
      pdf.match(/Q+/g)?.reduce((total, run) => total + run.length, 0),
    ).toBe(20_000);
    expect(readXrefOffsets(pdf)).toHaveLength(
      pdf.match(/^\d+ 0 obj$/gm)?.length ?? 0,
    );
  });

  it("never draws a line below the bottom of its page", () => {
    const pdf = asText([{ ...row, user_agent: "Q".repeat(20_000) }]);
    const streams = [...pdf.matchAll(/stream\n([\s\S]*?)endstream/g)];

    expect(streams.length).toBeGreaterThan(1);
    for (const [, stream] of streams) {
      const startY = Number(/\d+ (\d+) Td/.exec(stream)?.[1]);
      const advances = (stream.match(/T\*/g) ?? []).length;
      expect(startY - advances * lineLeadingForTest).toBeGreaterThanOrEqual(0);
    }
  });

  it("aligns the header labels with the columns they name", () => {
    // `document_version` is 16 characters and its column is 10 wide, so a
    // padEnd-only header pushed accepted_at and ip six characters right of the
    // data they label — unreadable in a document meant to be evidence.
    const [, , header, dataLine] = drawnLines(asText([row]));

    expect(header.length).toBe(dataLine.length);
    expect(header.indexOf("ip")).toBe(dataLine.indexOf("203.0.113.7"));
    expect(header.indexOf("accepted_at")).toBe(
      dataLine.indexOf("2026-08-14T15:02:00.000Z"),
    );
  });

  it("truncates an over-wide value instead of shifting every column after it", () => {
    const ipv6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    const [, , header, dataLine] = drawnLines(asText([{ ...row, ip: ipv6 }]));

    expect(dataLine.length).toBe(header.length);
    expect(dataLine).toContain("2001:0db8:85a");
    expect(dataLine).toContain("~");
  });
});
