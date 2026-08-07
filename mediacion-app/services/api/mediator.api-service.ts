import type { MockMediation } from '@/types/mediator';

import {
  codeCasoNotFound,
  codeMediacionNotFound,
  codeNotFound,
  hasCode,
} from './api-error';
import type { HttpClient } from './http-client';
import { toMediation, type ApiMediacion, type ApiMediadorOption } from './mediator-mapper';

export type ApiMediatorService = {
  getForCase(caseId: string): Promise<MockMediation | null>;
  listMediadores(caseId: string): Promise<ApiMediadorOption[]>;
  request(caseId: string, mediadorId: string): Promise<MockMediation>;
};

function isMissing(error: unknown): boolean {
  return (
    hasCode(error, codeMediacionNotFound) ||
    hasCode(error, codeCasoNotFound) ||
    hasCode(error, codeNotFound)
  );
}

export function createApiMediatorService(http: HttpClient): ApiMediatorService {
  return {
    /** The endpoint answers null — not 404 — when the caso simply has no mediacion yet. */
    async getForCase(caseId: string): Promise<MockMediation | null> {
      try {
        const row = await http.request<ApiMediacion | null>(
          `/casos/${caseId}/mediacion`,
        );
        return row === null ? null : toMediation(row);
      } catch (error) {
        if (isMissing(error)) {
          return null;
        }
        throw error;
      }
    },

    async listMediadores(caseId: string): Promise<ApiMediadorOption[]> {
      try {
        return await http.request<ApiMediadorOption[]>(
          `/casos/${caseId}/mediadores`,
        );
      } catch (error) {
        if (isMissing(error)) {
          return [];
        }
        throw error;
      }
    },

    async request(caseId: string, mediadorId: string): Promise<MockMediation> {
      const row = await http.request<ApiMediacion>(`/casos/${caseId}/mediacion`, {
        method: 'POST',
        body: { mediadorId },
      });
      return toMediation(row);
    },
  };
}
