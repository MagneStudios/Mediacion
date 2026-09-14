import { escapePdfTextLiteral, renderPdfPages } from "./pdf-writer";

const layout = {
  pageWidth: 595,
  pageHeight: 842,
  pageMargin: 40,
  fontSize: 9,
  lineLeading: 12,
};

describe("escapePdfTextLiteral", () => {
  it("escapes the three characters that can break out of a text literal", () => {
    expect(escapePdfTextLiteral("a(b)c\\d")).toBe("a\\(b\\)c\\\\d");
  });

  it("keeps latin1 accents, which WinAnsi can render", () => {
    expect(escapePdfTextLiteral("Mediación")).toBe("Mediación");
  });

  it("replaces anything outside WinAnsi rather than emitting invalid bytes", () => {
    expect(escapePdfTextLiteral("acuerdo 😀")).toBe("acuerdo ?");
  });

  it("turns control characters into spaces", () => {
    expect(escapePdfTextLiteral("a\tb\nc")).toBe("a b c");
  });
});

describe("renderPdfPages", () => {
  it("emits a structurally complete PDF for one page", () => {
    const rendered = renderPdfPages([["hola"]], layout).toString("latin1");

    expect(rendered.startsWith("%PDF-1.4")).toBe(true);
    expect(rendered).toContain("/Type /Catalog");
    expect(rendered).toContain("/Type /Pages");
    expect(rendered).toContain("/Count 1");
    expect(rendered).toContain("/BaseFont /Courier");
    expect(rendered).toContain("(hola) Tj");
    expect(rendered).toContain("xref");
    expect(rendered.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("declares one page object per page and counts them", () => {
    const rendered = renderPdfPages(
      [["uno"], ["dos"], ["tres"]],
      layout,
    ).toString("latin1");

    expect(rendered).toContain("/Count 3");
    expect(rendered).toContain("/Kids [4 0 R 6 0 R 8 0 R]");
  });

  it("points startxref at the byte offset where the xref table begins", () => {
    const rendered = renderPdfPages([["hola"]], layout).toString("latin1");

    const declared = Number(
      /startxref\n(\d+)/.exec(rendered)?.[1] ?? Number.NaN,
    );
    expect(rendered.slice(declared, declared + 4)).toBe("xref");
  });

  it("declares a stream length that matches the bytes actually written", () => {
    const rendered = renderPdfPages([["Mediación (parcial)"]], layout).toString(
      "latin1",
    );

    const declared = Number(/\/Length (\d+)/.exec(rendered)?.[1] ?? Number.NaN);
    const stream = rendered.slice(
      rendered.indexOf("stream\n") + "stream\n".length,
      rendered.indexOf("endstream"),
    );
    expect(Buffer.byteLength(stream, "latin1")).toBe(declared);
  });

  it("renders an empty page rather than a PDF with no pages at all", () => {
    const rendered = renderPdfPages([], layout).toString("latin1");

    expect(rendered).toContain("/Count 1");
    expect(rendered.startsWith("%PDF-1.4")).toBe(true);
  });
});
