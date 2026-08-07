import type { ActivityItem } from '@/types/activity';

import { toActivityItem, type ApiActivityEvent } from './activity-mapper';
import { codeCasoNotFound, codeNotFound, hasCode } from './api-error';
import type { HttpClient } from './http-client';

export type ApiActivityService = {
  listForCase(caseId: string): Promise<ActivityItem[]>;
};

function isMissing(error: unknown): boolean {
  return hasCode(error, codeCasoNotFound) || hasCode(error, codeNotFound);
}

export function createApiActivityService(http: HttpClient): ApiActivityService {
  return {
    /**
     * A caso that disappeared between listing and reading its feed yields an
     * empty timeline, not an error: the global feed is assembled from several
     * casos and one of them going away must not blank the whole screen.
     */
    async listForCase(caseId: string): Promise<ActivityItem[]> {
      try {
        const rows = await http.request<ApiActivityEvent[]>(
          `/casos/${caseId}/actividad`,
        );
        return rows
          .map((row) => toActivityItem(caseId, row))
          .filter((item): item is ActivityItem => item !== null);
      } catch (error) {
        if (isMissing(error)) {
          return [];
        }
        throw error;
      }
    },
  };
}
