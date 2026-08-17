import type {
  AcceptanceInput,
  AcceptanceStatus,
  ContactRequestInput,
  ContactRequestResult,
  LegalDocument,
  LegalDocumentType,
  WithdrawalRequestInput,
  WithdrawalRequestResult,
} from '@/types/legal';

import type { HttpClient } from './http-client';

/**
 * The frozen `/legal/*` contract (docs/reparto-tyc-devs.md §05), written
 * ahead of the backend: none of these endpoints exist in `apps/api` yet, so
 * this service is registered on the Backend composition root but NOT selected
 * by `services/legal.service.ts` — flipping that singleton is the one-line
 * activation once BE publishes the ficha of each function.
 *
 * Wire shapes are snake_case, matching the future `legal_documents` columns.
 */
export type ApiLegalDocument = {
  tipo: LegalDocumentType;
  version: string;
  contenido: string;
  /** Nullable on the wire: BE normalizes timestamps and returns null for unusable values. */
  valid_from: string | null;
  valid_to: string | null;
  is_substantial: boolean;
  resumen_cambios: string | null;
};

export function toLegalDocument(row: ApiLegalDocument): LegalDocument {
  return {
    tipo: row.tipo,
    version: row.version,
    contenido: row.contenido,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    isSubstantial: row.is_substantial,
    resumenCambios: row.resumen_cambios,
  };
}

export type ApiAcceptanceStatus = {
  pendientes: LegalDocumentType[];
  requiere_reaceptacion: boolean;
};

export function toAcceptanceStatus(row: ApiAcceptanceStatus): AcceptanceStatus {
  return {
    pendientes: row.pendientes,
    requiereReaceptacion: row.requiere_reaceptacion,
  };
}

/** BE's `SolicitudReceipt` — same shape for arrepentimiento and contacto. */
export type ApiSolicitudReceipt = {
  id: string;
  received_at: string | null;
};

export type ApiLegalService = {
  getCurrentDocument(tipo: LegalDocumentType): Promise<LegalDocument>;
  getScheduledDocument(tipo: LegalDocumentType): Promise<LegalDocument>;
  registerAcceptance(input: AcceptanceInput): Promise<void>;
  getAcceptanceStatus(): Promise<AcceptanceStatus>;
  requestWithdrawal(input: WithdrawalRequestInput): Promise<WithdrawalRequestResult>;
  requestContact(input: ContactRequestInput): Promise<ContactRequestResult>;
};

export function createApiLegalService(http: HttpClient): ApiLegalService {
  return {
    async getCurrentDocument(tipo) {
      const row = await http.request<ApiLegalDocument>(`/legal/documentos/${tipo}`);
      return toLegalDocument(row);
    },

    async getScheduledDocument(tipo) {
      // Same `LegalDocumentView` shape as the sibling read, so the mapper, the
      // type and the renderer are all reused and the banner can offer "leer el
      // texto nuevo" without a second call.
      const row = await http.request<ApiLegalDocument>(
        `/legal/documentos/${tipo}/programada`,
      );
      return toLegalDocument(row);
    },

    async registerAcceptance(input) {
      // The body carries ONLY the marketing opt-in. IP, user agent,
      // timestamp and current version are resolved by the server from the
      // request itself (instructivo error #3 — anything the client sends as
      // proof is forgeable and useless as evidence). The API enforces this:
      // `assertValidAcceptanceBody` rejects any extra key with 400.
      //
      // The key is omitted, not sent as undefined: on re-acceptance the
      // server must not rewrite the marketing choice made at signup, and
      // "absent" is what expresses that.
      const body = input.marketing === undefined ? {} : { marketing: input.marketing };
      await http.request<void>('/legal/aceptaciones', {
        method: 'POST',
        body,
      });
    },

    async getAcceptanceStatus() {
      const row = await http.request<ApiAcceptanceStatus>('/legal/aceptaciones/vigente');
      return toAcceptanceStatus(row);
    },

    async requestWithdrawal(input) {
      // Public endpoint — must work without a session (Res. 424/2020).
      const row = await http.request<ApiSolicitudReceipt>('/legal/arrepentimiento', {
        method: 'POST',
        body: { nombre: input.nombre, email: input.email, detalle: input.detalle },
      });
      return { id: row.id, receivedAt: row.received_at };
    },

    async requestContact(input) {
      // Also public: the contact channel has to be reachable by someone who
      // is not (or is no longer) a customer — instructivo §5.
      const row = await http.request<ApiSolicitudReceipt>('/legal/contacto', {
        method: 'POST',
        body: { nombre: input.nombre, email: input.email, mensaje: input.mensaje },
      });
      return { id: row.id, receivedAt: row.received_at };
    },
  };
}
