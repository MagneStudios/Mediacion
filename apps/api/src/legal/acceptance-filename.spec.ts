import { buildAcceptancesFilename } from "./acceptance-filename";

describe("buildAcceptancesFilename", () => {
  it("uses the range when it is given", () => {
    expect(buildAcceptancesFilename("2026-01-01", "2026-02-01", "csv")).toBe(
      "aceptaciones-2026-01-01-2026-02-01.csv",
    );
  });

  it("carries the extension the caller asks for", () => {
    expect(buildAcceptancesFilename("2026-01-01", "2026-02-01", "pdf")).toBe(
      "aceptaciones-2026-01-01-2026-02-01.pdf",
    );
  });

  it("falls back to readable bounds when the range is open", () => {
    expect(buildAcceptancesFilename(undefined, undefined, "csv")).toBe(
      "aceptaciones-inicio-hoy.csv",
    );
  });

  it("strips anything a caller could use to break out of the Content-Disposition header", () => {
    expect(
      buildAcceptancesFilename(
        '2026-01-01"\r\nX-Injected: 1',
        "2026-02-01",
        "csv",
      ),
    ).toBe("aceptaciones-2026-01-01X-Injected:1-2026-02-01.csv");
  });

  it("falls back when the filter is nothing but unsafe characters", () => {
    expect(buildAcceptancesFilename('"', "/../", "pdf")).toBe(
      "aceptaciones-inicio-hoy.pdf",
    );
  });
});
