import type { DecisionPropuesta } from '@/types/negotiation';

import type { HttpClient } from './http-client';
import type { ApiNegociacion, ApiPropuestaDetail, ApiPropuestaView, ApiRenegociacion } from './negotiation-mapper';

export type ApiNegotiationService = {
  listPropuestas(caseId: string): Promise<ApiPropuestaDetail[]>;
  generatePropuesta(caseId: string): Promise<ApiPropuestaView>;
  responder(proposalId: string, decision: DecisionPropuesta): Promise<ApiPropuestaView>;
  /** A caso with no negociaciones answers `[]`, not 404 — nothing to swallow here. */
  listNegociaciones(caseId: string): Promise<ApiNegociacion[]>;
  /**
   * Opens the next round on a materia whose acuerdo in force is signed.
   * `409 negociacion_not_acordada` otherwise — including twice in a row.
   */
  renegociar(negotiationId: string): Promise<ApiRenegociacion>;
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

    listNegociaciones(caseId: string): Promise<ApiNegociacion[]> {
      return http.request<ApiNegociacion[]>(`/casos/${caseId}/negociaciones`);
    },

    renegociar(negotiationId: string): Promise<ApiRenegociacion> {
      return http.request<ApiRenegociacion>(`/negociaciones/${negotiationId}/renegociar`, {
        method: 'POST',
      });
    },
  };
}
