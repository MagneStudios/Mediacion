import {
  buildAcceptancesCsv,
  buildAcceptancesFilename,
} from "./acceptance-csv";
import type { AcceptanceExportRow } from "./legal.types";

describe("buildAcceptancesCsv", () => {
  const row: AcceptanceExportRow = {
    user_id: "user-1",
    document_type: "terms",
    document_version: "v1.0",
    accepted_at: "2026-08-14T15:02:00.000Z",
    ip: "203.0.113.7",
    user_agent: "Expo/1.0",
  };

  it("emits the six columns the instructivo demands, in order", () => {
    expect(buildAcceptancesCsv([])).toBe(
      "user_id,document_type,document_version,accepted_at,ip,user_agent\r\n",
    );
  });

  it("writes one line per acceptance", () => {
    expect(buildAcceptancesCsv([row])).toContain(
      "user-1,terms,v1.0,2026-08-14T15:02:00.000Z,203.0.113.7,Expo/1.0\r\n",
    );
  });

  it("normalizes the Date the driver returns for accepted_at", () => {
    const csv = buildAcceptancesCsv([
      {
        ...row,
        accepted_at: new Date("2026-08-14T15:02:00.000Z") as unknown as string,
      },
    ]);

    expect(csv).toContain("2026-08-14T15:02:00.000Z");
  });

  it("quotes and escapes a user agent with commas and quotes", () => {
    const csv = buildAcceptancesCsv([
      { ...row, user_agent: 'Mozilla/5.0 (X11; Linux), "test"' },
    ]);

    expect(csv).toContain('"Mozilla/5.0 (X11; Linux), ""test"""');
  });
});

describe("buildAcceptancesFilename", () => {
  it("uses the range when it is given", () => {
    expect(buildAcceptancesFilename("2026-01-01", "2026-02-01")).toBe(
      "aceptaciones-2026-01-01-2026-02-01.csv",
    );
  });

  it("falls back to readable bounds when the range is open", () => {
    expect(buildAcceptancesFilename(undefined, undefined)).toBe(
      "aceptaciones-inicio-hoy.csv",
    );
  });

  it("strips anything a caller could use to break out of the Content-Disposition header", () => {
    expect(
      buildAcceptancesFilename('2026-01-01"\r\nX-Injected: 1', "2026-02-01"),
    ).toBe("aceptaciones-2026-01-01X-Injected:1-2026-02-01.csv");
  });

  it("falls back when the filter is nothing but unsafe characters", () => {
    expect(buildAcceptancesFilename('"', "/../")).toBe(
      "aceptaciones-inicio-hoy.csv",
    );
  });
});
