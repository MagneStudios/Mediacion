export type PositionInput = {
  categoria: string;
  valor_min: string | null;
  valor_max: string | null;
};

export type MeetingPointEntry = {
  categoria: string;
  punto: number | null;
  estado: "acordable" | "negociable";
};

type Range = { min: number; max: number };

function parseFinite(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rangeForCategoria(
  positions: PositionInput[],
  categoria: string,
): Range | undefined {
  const matching = positions.filter(
    (position) => position.categoria === categoria,
  );
  const mins = matching
    .map((position) => parseFinite(position.valor_min))
    .filter((value): value is number => value !== undefined);
  const maxs = matching
    .map((position) => parseFinite(position.valor_max))
    .filter((value): value is number => value !== undefined);
  if (mins.length === 0 || maxs.length === 0) {
    return undefined;
  }
  const min = Math.min(...mins);
  const max = Math.max(...maxs);
  if (min > max) {
    return undefined;
  }
  return { min, max };
}

function sharedCategorias(
  positionsA: PositionInput[],
  positionsB: PositionInput[],
): string[] {
  const categoriasB = new Set(positionsB.map((position) => position.categoria));
  const categoriasA = new Set(positionsA.map((position) => position.categoria));
  return [...categoriasA].filter((categoria) => categoriasB.has(categoria));
}

export function computeMeetingPoints(
  positionsA: PositionInput[],
  positionsB: PositionInput[],
): MeetingPointEntry[] {
  return sharedCategorias(positionsA, positionsB).map((categoria) => {
    const rangeA = rangeForCategoria(positionsA, categoria);
    const rangeB = rangeForCategoria(positionsB, categoria);
    if (!rangeA || !rangeB) {
      return { categoria, punto: null, estado: "negociable" };
    }
    const overlapMin = Math.max(rangeA.min, rangeB.min);
    const overlapMax = Math.min(rangeA.max, rangeB.max);
    if (overlapMin <= overlapMax) {
      return {
        categoria,
        punto: (overlapMin + overlapMax) / 2,
        estado: "acordable",
      };
    }
    return { categoria, punto: null, estado: "negociable" };
  });
}
