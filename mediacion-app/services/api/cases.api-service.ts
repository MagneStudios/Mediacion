import type {
  CaseDetail,
  CaseInvitation,
  CaseSummary,
  CreateCaseInput,
  CreateInvitationInput,
} from '@/types/case';

import { codeCasoNotFound, codeNotFound, hasCode } from './api-error';
import {
  toCaseDetail,
  toCaseSummary,
  type ApiCaseDetail,
  type ApiCaseSummary,
} from './case-mapper';
import type { HttpClient } from './http-client';

type ApiInvitation = {
  id: string;
  tipo: CaseInvitation['tipo'];
  token: string | null;
  estado: CaseInvitation['estado'];
};

export type ApiCasesService = {
  listCases(): Promise<CaseSummary[]>;
  getCaseDetail(caseId: string): Promise<CaseDetail | undefined>;
  createCase(input: CreateCaseInput): Promise<CaseSummary>;
  createInvitation(input: CreateInvitationInput): Promise<CaseInvitation>;
  getCaseTitle(caseId: string): Promise<string | null>;
  joinCase(token: string): Promise<{ id: string; estado: string }>;
};

/** A caso the caller cannot see and a caso that does not exist are the same 404. */
function isMissing(error: unknown): boolean {
  return hasCode(error, codeCasoNotFound) || hasCode(error, codeNotFound);
}

export function createApiCasesService(
  http: HttpClient,
  clock: () => Date = () => new Date(),
): ApiCasesService {
  async function fetchDetail(caseId: string): Promise<CaseDetail | undefined> {
    try {
      const row = await http.request<ApiCaseDetail>(`/casos/${caseId}`);
      return toCaseDetail(row, clock());
    } catch (error) {
      if (isMissing(error)) {
        return undefined;
      }
      throw error;
    }
  }

  return {
    async listCases(): Promise<CaseSummary[]> {
      const rows = await http.request<ApiCaseSummary[]>('/casos');
      const now = clock();
      return rows.map((row) => toCaseSummary(row, now));
    },

    getCaseDetail: fetchDetail,

    /**
     * POST /casos answers with only `{id, estado}`, so the freshly created case
     * is read back to get the shape the list renders — rather than guessing at
     * server-assigned fields.
     */
    async createCase(input: CreateCaseInput): Promise<CaseSummary> {
      const created = await http.request<{ id: string }>('/casos', {
        method: 'POST',
        body: {
          nombre: input.nombre,
          descripcion: input.descripcion ?? null,
          metodo: input.metodo,
        },
      });
      const detail = await fetchDetail(created.id);
      if (detail === undefined) {
        throw new Error(`Caso ${created.id} was not readable right after creation`);
      }
      return detail;
    },

    async createInvitation(input: CreateInvitationInput): Promise<CaseInvitation> {
      const created = await http.request<ApiInvitation>(
        `/casos/${input.casoId}/invitaciones`,
        {
          method: 'POST',
          body: {
            tipo: input.tipo,
            ...(input.emailDestino ? { email_destino: input.emailDestino } : {}),
          },
        },
      );
      // The API returns no caseId/createdAt, and there is no read endpoint for
      // invitations, so those are completed locally from what we already know.
      return {
        id: created.id,
        caseId: input.casoId,
        tipo: created.tipo,
        token: created.token,
        emailDestino: input.emailDestino ?? null,
        estado: created.estado,
        createdAt: clock().toISOString(),
      };
    },

    async getCaseTitle(caseId: string): Promise<string | null> {
      const detail = await fetchDetail(caseId);
      return detail?.title ?? null;
    },

    joinCase(token: string): Promise<{ id: string; estado: string }> {
      return http.request('/casos/unirse', { method: 'POST', body: { token } });
    },
  };
}
