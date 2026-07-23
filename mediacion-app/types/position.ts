/**
 * Domain types for a party's own private position items (`items` table /
 * RN-01 absolute isolation). Field names mirror the schema's
 * `categoria_item` enum and column names conceptually — but `valueMin`/
 * `valueMax` are `string` only, matching the backend's `text` columns
 * exactly (the schema stores both numeric and descriptive values in the
 * same column, e.g. "50000" or "fines de semana" — there is no numeric
 * column to diverge from). This file does not import from
 * packages/db-types or apps/api.
 *
 * These types only ever describe the authenticated party's own items —
 * there is no counterparty-position shape anywhere in this file, by design.
 */

export type CategoriaPosicion = 'cuidado_ninos' | 'cronogramas' | 'bienes' | 'economico' | 'personalizado';

export type PositionItem = {
  id: string;
  caseId: string;
  ownerId: string;
  category: CategoriaPosicion;
  name: string;
  description?: string;
  valueMin: string;
  valueMax: string;
  canConcede: boolean;
  concessionConditions?: string;
  private: true;
  createdAt: string;
  updatedAt: string;
};

export type CreatePositionInput = {
  caseId: string;
  category: CategoriaPosicion;
  name: string;
  description?: string;
  valueMin: string;
  valueMax: string;
  canConcede: boolean;
  concessionConditions?: string;
};

export type UpdatePositionInput = CreatePositionInput & {
  id: string;
};
