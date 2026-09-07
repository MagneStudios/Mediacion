import type { BreachNotice, EstadoAcuerdo, SignatureInboxItem } from '@/types/agreement';

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

/** `IncumplimientoView` — the whole row the API is willing to show. */
export type ApiIncumplimiento = {
  id: string;
  acuerdo_id: string;
  reportante_id: string;
  descripcion: string;
  fecha: string;
  created_at: string;
};

export function toBreachNotice(row: ApiIncumplimiento): BreachNotice {
  return {
    id: row.id,
    agreementId: row.acuerdo_id,
    reporterId: row.reportante_id,
    description: row.descripcion,
    fecha: row.fecha,
  };
}

export type ApiAgreementsService = {
  getForCase(caseId: string): Promise<ApiAgreementBundle | null>;
  generate(caseId: string): Promise<ApiAcuerdo>;
  sendToSignature(agreementId: string): Promise<ApiAcuerdo>;
  registerBreach(agreementId: string, description: string): Promise<BreachNotice>;
  listBreachNotices(agreementId: string): Promise<BreachNotice[]>;
  exportAgreement(agreementId: string): Promise<string>;
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
     * Registers the breach and, in the same server transaction, moves the
     * acuerdo to `con_aviso` (`incumplimientos.repository.ts`). Callers must
     * re-read the agreement afterwards rather than assume the estado —
     * `agreements.backed-service.ts` does exactly that.
     *
     * `descripcion` is trimmed server-side and rejected empty with
     * `invalid_input`; it is sent as typed, so the server stays the
     * validating boundary rather than trusting a client that already checked.
     */
    registerBreach(agreementId: string, description: string): Promise<BreachNotice> {
      return http
        .request<ApiIncumplimiento>(`/acuerdos/${agreementId}/incumplimiento`, {
          method: 'POST',
          body: { descripcion: description },
        })
        .then(toBreachNotice);
    },

    /** Newest first, the order the server already applies (`fecha desc`). */
    async listBreachNotices(agreementId: string): Promise<BreachNotice[]> {
      const rows = await http.request<ApiIncumplimiento[]>(
        `/acuerdos/${agreementId}/incumplimientos`,
      );
      return rows
        .map(toBreachNotice)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    },

    /**
     * The one route in the API that does not answer JSON: `text/plain`, with
     * the document as the whole body. Hence `requestText`.
     *
     * The `Content-Disposition` filename the server sets is deliberately not
     * read: on Expo Web it is invisible anyway (the API sends no
     * `Access-Control-Expose-Headers`, `main.ts`), and nothing in this app
     * saves a file for it to name. Pedido a BE en
     * `docs/pedidos-frontend-a-backend.md` §9 for the day that changes.
     */
    exportAgreement(agreementId: string): Promise<string> {
      return http.requestText(`/acuerdos/${agreementId}/exportar`);
    },

    /**
     * `GET /firmas` already carries the caso name and the caller's own state, so
     * the inbox needs no per-row follow-up request.
     */
    async listSignatureInbox(): Promise<SignatureInboxItem[]> {
      const rows = await http.request<ApiSignatureInboxEntry[]>('/firmas');
      return rows.map((row) => ({
        agreementId: row.acuerdo_id,
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
