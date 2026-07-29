import type {
  CategoriaPosicion,
  CreatePositionInput,
  PositionItem,
  UpdatePositionInput,
} from '@/types/position';

/**
 * The API stores valor_min/valor_max as nullable text — the same column holds
 * "50000" and "fines de semana". The app models them as plain strings, so a
 * null becomes an empty string rather than leaking null into the UI.
 */
export type ApiItem = {
  id: string;
  caso_id: string;
  parte_id: string;
  categoria: CategoriaPosicion;
  nombre: string;
  descripcion: string | null;
  valor_min: string | null;
  valor_max: string | null;
  puede_ceder: boolean;
  condiciones_cesion: string | null;
  privado: boolean;
  created_at: string;
  updated_at: string;
};

export type ApiCreateItem = {
  categoria: CategoriaPosicion;
  nombre: string;
  descripcion: string | null;
  valor_min: string | null;
  valor_max: string | null;
  puede_ceder: boolean;
  condiciones_cesion: string | null;
};

function optional(value: string | null): string | undefined {
  return value === null || value.length === 0 ? undefined : value;
}

export function toPositionItem(row: ApiItem): PositionItem {
  return {
    id: row.id,
    caseId: row.caso_id,
    ownerId: row.parte_id,
    category: row.categoria,
    name: row.nombre,
    description: optional(row.descripcion),
    valueMin: row.valor_min ?? '',
    valueMax: row.valor_max ?? '',
    canConcede: row.puede_ceder,
    concessionConditions: optional(row.condiciones_cesion),
    // RN-01: an item read through the own-scoped endpoints is private by
    // definition. The column is never surfaced as anything else.
    private: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * `caseId` and `id` are deliberately absent from the payload: they travel in
 * the path, and the API strips them from a body anyway (mass-assignment
 * defense). Sending them would only invite drift.
 */
export function toApiCreateItem(
  input: CreatePositionInput | UpdatePositionInput,
): ApiCreateItem {
  return {
    categoria: input.category,
    nombre: input.name,
    descripcion: input.description ?? null,
    valor_min: input.valueMin.length === 0 ? null : input.valueMin,
    valor_max: input.valueMax.length === 0 ? null : input.valueMax,
    puede_ceder: input.canConcede,
    condiciones_cesion: input.concessionConditions ?? null,
  };
}
