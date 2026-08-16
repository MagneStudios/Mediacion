import { mockCompanyInfo, mockLegalDocuments } from '../mocks/legal';
import type {
  AcceptanceInput,
  AcceptanceStatus,
  CompanyInfo,
  LegalDocument,
  LegalDocumentType,
  WithdrawalRequestInput,
  WithdrawalRequestResult,
} from '../types/legal';

import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * Legal module (TyC + Privacidad — instructivo Golosetti, reparto
 * `docs/reparto-tyc-devs.md`). Fully mock-only, no `services/api/legal.*`
 * counterpart active yet: neither the tables (`legal_documents`,
 * `user_agreements`) nor any `/legal/*` endpoint exist in `apps/api` or
 * `supabase/migrations` as of dev@4d42fe3 (verified: PR #100 brought the
 * legal *docs*, not the schema). This mirrors the `plans.service.ts`
 * precedent — built and tested against the frozen contract, swapped to the
 * real API without touching screens once DB/BE land theirs.
 *
 * The frozen contract this expects (reparto §05):
 * - `GET  /legal/documentos/:tipo`      → current version + `valid_from`
 * - `POST /legal/aceptaciones`          → body `{ marketing: boolean }` ONLY.
 *   IP, user agent, timestamp and version are read from the request
 *   server-side (instructivo error #3: client-supplied proof is forgeable).
 *   The DB constraint — not this call, not any checkbox — is what ultimately
 *   guarantees "no contratás sin aceptar" (reparto §00).
 * - `GET  /legal/aceptaciones/vigente`  → what's pending, for the gate
 * - `POST /legal/arrepentimiento`       → public, no session (Res. 424/2020)
 */
export type LegalService = {
  getCurrentDocument(tipo: LegalDocumentType): Promise<LegalDocument | undefined>;
  registerAcceptance(input: AcceptanceInput): Promise<void>;
  getAcceptanceStatus(): Promise<AcceptanceStatus>;
  requestWithdrawal(input: WithdrawalRequestInput): Promise<WithdrawalRequestResult>;
  getCompanyInfo(): Promise<CompanyInfo>;
};

type FailableOperation = 'getCurrentDocument' | 'registerAcceptance' | 'requestWithdrawal';

const failures = createFailureController<FailableOperation>();

export function __mockForceLegalFailure(operation: FailableOperation): void {
  failures.force(operation);
}

/** In-memory only — mirrors what the append-only `user_agreements` rows would record. */
let acceptedTypes: Set<LegalDocumentType> = new Set();

/** Test-only: back to "nothing accepted yet". Never imported by a screen. */
export function __resetMockLegalState(): void {
  acceptedTypes = new Set();
}

let withdrawalCounter = 0;

export function createMockLegalService(): LegalService {
  return {
    async getCurrentDocument(tipo) {
      if (failures.consume('getCurrentDocument')) {
        return rejectAfter('mock_get_legal_document_failed', 400);
      }
      const current = mockLegalDocuments.find(
        (doc) => doc.tipo === tipo && doc.validTo === null,
      );
      return delay(current, 400);
    },

    async registerAcceptance(_input) {
      if (failures.consume('registerAcceptance')) {
        return rejectAfter('mock_register_acceptance_failed', 500);
      }
      // The marketing opt-in (true or false) would be its own row too; the
      // mock only tracks what the gate reads back.
      await delay(undefined, 400);
      acceptedTypes = new Set(['terms', 'privacy']);
    },

    async getAcceptanceStatus() {
      const pendientes = mockLegalDocuments
        .filter((doc) => doc.validTo === null && !acceptedTypes.has(doc.tipo))
        .map((doc) => doc.tipo);
      const requiereReaceptacion = mockLegalDocuments.some(
        (doc) => doc.validTo === null && doc.isSubstantial && !acceptedTypes.has(doc.tipo),
      );
      return delay({ pendientes, requiereReaceptacion }, 300);
    },

    async requestWithdrawal(input) {
      if (failures.consume('requestWithdrawal')) {
        return rejectAfter('mock_request_withdrawal_failed', 500);
      }
      if (!input.nombre.trim() || !input.email.trim() || !input.detalle.trim()) {
        return rejectAfter('withdrawal_missing_fields', 300);
      }
      withdrawalCounter += 1;
      return delay(
        {
          id: `arr-${String(withdrawalCounter).padStart(4, '0')}`,
          receivedAt: new Date().toISOString(),
        },
        600,
      );
    },

    async getCompanyInfo() {
      return delay(mockCompanyInfo, 200);
    },
  };
}

/** Default instance consumed by the legal screens and checkboxes. */
export const legalService: LegalService = createMockLegalService();
