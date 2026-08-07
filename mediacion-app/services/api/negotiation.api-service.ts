import type { DecisionPropuesta } from '@/types/negotiation';

import type { HttpClient } from './http-client';
import type { ApiPropuestaDetail, ApiPropuestaView } from './negotiation-mapper';

export type ApiNegotiationService = {
  listPropuestas(caseId: string): Promise<ApiPropuestaDetail[]>;
  generatePropuesta(caseId: string): Promise<ApiPropuestaView>;
  responder(proposalId: string, decision: DecisionPropuesta): Promise<ApiPropuestaView>;
};

export function createApiNegotiationService(http: HttpClient): ApiNegotiationService {
  return {
    listPropuestas(caseId: string): Promise<ApiPropuestaDetail[]> {
      return http.request<ApiPropuestaDetail[]>(`/casos/${caseId}/propuestas`);
    },

    /**
     * Returns immediately with a pending row — the AI narrative is written
     * afterwards, so the caller must re-read to see it rather than assume the
     * response is final.
     */
    generatePropuesta(caseId: string): Promise<ApiPropuestaView> {
      return http.request<ApiPropuestaView>(`/casos/${caseId}/propuestas`, {
        method: 'POST',
      });
    },

    responder(proposalId: string, decision: DecisionPropuesta): Promise<ApiPropuestaView> {
      return http.request<ApiPropuestaView>(`/propuestas/${proposalId}/responder`, {
        method: 'POST',
        body: { decision },
      });
    },
  };
}
