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
  joinCase(token: string): Promise<{ id: string; estado: string; requiresPayment: boolean }>;
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
            // R-07: `pago_a_cargo` is a backend TODO per the reunión plan —
            // sent defensively so this call is already correct once the
            // column/endpoint exist, and harmless (an unknown field) until then.
            pago_a_cargo: input.pagoACargo,
          },
        },
      );
      // The API returns no caseId/createdAt, and there is no read endpoint for
      // invitations, so those are completed locally from what we already know
      // — pagoACargo included, since it's exactly what we just sent.
      return {
        id: created.id,
        caseId: input.casoId,
        tipo: created.tipo,
        token: created.token,
        emailDestino: input.emailDestino ?? null,
        estado: created.estado,
        pagoACargo: input.pagoACargo,
        createdAt: clock().toISOString(),
      };
    },

    async getCaseTitle(caseId: string): Promise<string | null> {
      const detail = await fetchDetail(caseId);
      return detail?.title ?? null;
    },

    joinCase(token: string): Promise<{ id: string; estado: string; requiresPayment: boolean }> {
      // R-07: `requiresPayment` is an unchecked cast like every other field
      // here — if the backend's `POST /casos/unirse` doesn't send it yet,
      // this resolves to `undefined`, which the join screen already treats
      // as falsy (no payment gate), a silent no-op rather than a crash.
      return http.request('/casos/unirse', { method: 'POST', body: { token } });
    },
  };
}
