import type { PositionInput } from "./meeting-point";
import { computeMeetingPoints } from "./meeting-point";

function position(
  categoria: string,
  valorMin: string | null,
  valorMax: string | null,
): PositionInput {
  return { categoria, valor_min: valorMin, valor_max: valorMax };
}

describe("computeMeetingPoints", () => {
  it("returns the overlap midpoint when both ranges intersect", () => {
    const positionsA = [position("economico", "100", "500")];
    const positionsB = [position("economico", "200", "400")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(result).toEqual([
      { categoria: "economico", punto: 300, estado: "acordable" },
    ]);
  });

  it("emits no numeric punto when the ranges are disjoint, only a negociable marker", () => {
    const positionsA = [position("bienes", "100", "200")];
    const positionsB = [position("bienes", "500", "700")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(result).toEqual([
      { categoria: "bienes", punto: null, estado: "negociable" },
    ]);
  });

  it("RN-01: a disjoint result carries no digit a party could use to derive the other party's boundary", () => {
    const positionsA = [position("bienes", "100", "200")];
    const positionsB = [position("bienes", "500", "700")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(/\d/.test(JSON.stringify(result))).toBe(false);
  });

  it("emits a negociable marker with no numeric point when independently-nullable items aggregate to an inverted range", () => {
    const positionsA = [
      position("economico", "500", null),
      position("economico", null, "100"),
    ];
    const positionsB = [position("economico", "50", "150")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(result).toEqual([
      { categoria: "economico", punto: null, estado: "negociable" },
    ]);
  });

  it("treats empty-string bounds as absent instead of fabricating a zero boundary", () => {
    const positionsA = [position("economico", "", "500")];
    const positionsB = [position("economico", "100", "200")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(result).toEqual([
      { categoria: "economico", punto: null, estado: "negociable" },
    ]);
  });

  it("treats whitespace-only bounds as absent instead of fabricating a zero boundary", () => {
    const positionsA = [position("economico", "  ", "500")];
    const positionsB = [position("economico", "100", "200")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(result).toEqual([
      { categoria: "economico", punto: null, estado: "negociable" },
    ]);
  });

  it("emits a negociable marker with no numeric point when a range is non-numeric", () => {
    const positionsA = [position("cronogramas", "un fin de semana", null)];
    const positionsB = [position("cronogramas", "100", "200")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(result).toEqual([
      { categoria: "cronogramas", punto: null, estado: "negociable" },
    ]);
  });

  it("only computes points for categorias present on both sides", () => {
    const positionsA = [
      position("economico", "100", "200"),
      position("personalizado", "10", "20"),
    ];
    const positionsB = [position("economico", "150", "250")];

    const result = computeMeetingPoints(positionsA, positionsB);

    expect(result).toEqual([
      { categoria: "economico", punto: 175, estado: "acordable" },
    ]);
  });
});
