import {
  anchoredBillingPeriod,
  billingPeriodDays,
  billingPeriodMs,
  billingPeriodStartingAt,
} from "./billing-period";

const dayMs = 24 * 60 * 60 * 1000;

describe("billing period", () => {
  it("spans exactly 30 days from the given start", () => {
    const start = new Date("2026-09-03T12:00:00.000Z");

    const period = billingPeriodStartingAt(start);

    expect(period).toEqual({
      period_start: "2026-09-03T12:00:00.000Z",
      period_end: "2026-10-03T12:00:00.000Z",
    });
    expect(billingPeriodDays).toBe(30);
    expect(billingPeriodMs).toBe(30 * dayMs);
  });

  it("anchors the window containing now on fecha_inicio, 45 days later landing on the second window", () => {
    const inicio = new Date("2026-07-20T00:00:00.000Z");
    const now = new Date(inicio.getTime() + 45 * dayMs);

    const period = anchoredBillingPeriod(inicio, now);

    expect(period).toEqual({
      period_start: "2026-08-19T00:00:00.000Z",
      period_end: "2026-09-18T00:00:00.000Z",
    });
  });

  it("returns the first window while now is still inside it", () => {
    const inicio = new Date("2026-09-01T00:00:00.000Z");
    const now = new Date(inicio.getTime() + 29 * dayMs);

    expect(anchoredBillingPeriod(inicio, now)).toEqual({
      period_start: "2026-09-01T00:00:00.000Z",
      period_end: "2026-10-01T00:00:00.000Z",
    });
  });

  it("starts a new window exactly at the 30-day boundary, never extending the previous one", () => {
    const inicio = new Date("2026-09-01T00:00:00.000Z");
    const now = new Date(inicio.getTime() + 30 * dayMs);

    expect(anchoredBillingPeriod(inicio, now).period_start).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("does not move the window backwards when fecha_inicio is in the future", () => {
    const inicio = new Date("2026-09-10T00:00:00.000Z");
    const now = new Date("2026-09-03T00:00:00.000Z");

    expect(anchoredBillingPeriod(inicio, now).period_start).toBe(
      "2026-09-10T00:00:00.000Z",
    );
  });
});
