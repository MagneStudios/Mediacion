import { normalizeTimestamp } from "./timestamp";

describe("normalizeTimestamp", () => {
  it("converts the Date the pg driver returns for a TIMESTAMPTZ column", () => {
    expect(normalizeTimestamp(new Date("2026-08-15T13:30:00.000Z"))).toBe(
      "2026-08-15T13:30:00.000Z",
    );
  });

  it("normalizes an ISO string to its canonical UTC form", () => {
    expect(normalizeTimestamp("2026-08-15T13:30:00.000Z")).toBe(
      "2026-08-15T13:30:00.000Z",
    );
    expect(normalizeTimestamp("2026-08-15T10:30:00.000-03:00")).toBe(
      "2026-08-15T13:30:00.000Z",
    );
  });

  it("pins an offset-less datetime to an explicit instant instead of leaving it ambiguous", () => {
    const normalized = normalizeTimestamp("2026-08-15T13:30:00");

    expect(normalized).toBe(new Date("2026-08-15T13:30:00").toISOString());
    expect(normalized).toMatch(/Z$/);
  });

  it.each([undefined, null, "", "   ", "manana", 42, {}, new Date("nope")])(
    "returns null for %p",
    (value) => {
      expect(normalizeTimestamp(value)).toBeNull();
    },
  );
});
