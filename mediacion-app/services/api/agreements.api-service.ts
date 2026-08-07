import type { EstadoAcuerdo, SignatureInboxItem } from '@/types/agreement';

import { toSignatureStatus, type ApiAcuerdo, type ApiFirmaStatus } from './agreement-mapper';
import {
  codeAcuerdoNotFound,
  codeCasoNotFound,
  codeNotFound,
  hasCode,
} from './api-error';
import type { HttpClient } from './http-client';

export type ApiAgreementBundle = { acuerdo: ApiAcuerdo; firmas: ApiFirmaStatus[] };

export type ApiSignatureInboxEntry = {
  acuerdo_id: string;
  caso_id: string;
  caso_nombre: string;
  caso_codigo: string | null;
  acuerdo_estado: EstadoAcuerdo;
  own_status: string;
  own_fecha_firma: string | null;
  pending_signers: number;
};

export type ApiAgreementsService = {
  getForCase(caseId: string): Promise<ApiAgreementBundle | null>;
  generate(caseId: string): Promise<ApiAcuerdo>;
  sendToSignature(agreementId: string): Promise<ApiAcuerdo>;
  listSignatureInbox(): Promise<SignatureInboxItem[]>;
};

/**
 * `GET /casos/:id/acuerdo` answers `acuerdo_not_found` — not `caso_not_found` —
 * when the caso exists but has no acuerdo yet, which is the common case. Verified
 * against the deployed API: omitting it made a caso without an agreement throw
 * instead of resolving to null.
 */
function isMissing(error: unknown): boolean {
  return (
    hasCode(error, codeAcuerdoNotFound) ||
    hasCode(error, codeCasoNotFound) ||
    hasCode(error, codeNotFound)
  );
}

export function createApiAgreementsService(http: HttpClient): ApiAgreementsService {
  return {
    /** A caso with no acuerdo yet is a 404, which is a legitimate "not there", not a failure. */
    async getForCase(caseId: string): Promise<ApiAgreementBundle | null> {
      try {
        return await http.request<ApiAgreementBundle>(`/casos/${caseId}/acuerdo`);
      } catch (error) {
        if (isMissing(error)) {
          return null;
        }
        throw error;
      }
    },

    generate(caseId: string): Promise<ApiAcuerdo> {
      return http.request<ApiAcuerdo>(`/casos/${caseId}/acuerdo`, { method: 'POST' });
    },

    sendToSignature(agreementId: string): Promise<ApiAcuerdo> {
      return http.request<ApiAcuerdo>(`/acuerdos/${agreementId}/firmar`, {
        method: 'POST',
      });
    },

    /**
     * `GET /firmas` already carries the caso name and the caller's own state, so
     * the inbox needs no per-row follow-up request.
     */
    async listSignatureInbox(): Promise<SignatureInboxItem[]> {
      const rows = await http.request<ApiSignatureInboxEntry[]>('/firmas');
      return rows.map((row) => ({
        caseId: row.caso_id,
        caseTitle: row.caso_nombre,
        agreementTitle: row.caso_nombre,
        estado: row.acuerdo_estado,
        ownStatus: toSignatureStatus(row.own_status),
        // Only a fully signed acuerdo with no pending signers is complete.
        ...(row.pending_signers === 0 && row.own_fecha_firma
          ? { completedAt: row.own_fecha_firma }
          : {}),
      }));
    },
  };
}
