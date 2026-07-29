import type {
  CreatePositionInput,
  PositionItem,
  UpdatePositionInput,
} from '@/types/position';

import { codeItemNotFound, codeNotFound, hasCode } from './api-error';
import type { HttpClient } from './http-client';
import { toApiCreateItem, toPositionItem, type ApiItem } from './position-mapper';

export type PositionsApiService = {
  getOwnPositions(caseId: string): Promise<PositionItem[]>;
  getOwnPosition(caseId: string, positionId: string): Promise<PositionItem | null>;
  createOwnPosition(input: CreatePositionInput): Promise<PositionItem>;
  updateOwnPosition(input: UpdatePositionInput): Promise<PositionItem>;
  deleteOwnPosition(caseId: string, positionId: string): Promise<void>;
};

function isMissing(error: unknown): boolean {
  return hasCode(error, codeItemNotFound) || hasCode(error, codeNotFound);
}

/**
 * Every route here is owner-scoped server-side (RN-01): the API filters by
 * parte_id, so an item belonging to the other parte is indistinguishable from
 * one that does not exist. This service never sends an owner id — doing so
 * would imply the caller can choose one.
 */
export function createApiPositionsService(http: HttpClient): PositionsApiService {
  return {
    async getOwnPositions(caseId: string): Promise<PositionItem[]> {
      const rows = await http.request<ApiItem[]>(`/casos/${caseId}/items`);
      return rows.map(toPositionItem);
    },

    async getOwnPosition(
      _caseId: string,
      positionId: string,
    ): Promise<PositionItem | null> {
      try {
        const row = await http.request<ApiItem>(`/items/${positionId}`);
        return toPositionItem(row);
      } catch (error) {
        if (isMissing(error)) {
          return null;
        }
        throw error;
      }
    },

    async createOwnPosition(input: CreatePositionInput): Promise<PositionItem> {
      const row = await http.request<ApiItem>(`/casos/${input.caseId}/items`, {
        method: 'POST',
        body: toApiCreateItem(input),
      });
      return toPositionItem(row);
    },

    async updateOwnPosition(input: UpdatePositionInput): Promise<PositionItem> {
      const row = await http.request<ApiItem>(`/items/${input.id}`, {
        method: 'PATCH',
        body: toApiCreateItem(input),
      });
      return toPositionItem(row);
    },

    /** Answers 204 with no body; a missing or foreign item surfaces as 404. */
    deleteOwnPosition(_caseId: string, positionId: string): Promise<void> {
      return http.request<void>(`/items/${positionId}`, { method: 'DELETE' });
    },
  };
}
