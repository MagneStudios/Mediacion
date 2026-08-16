import { mockCompanyInfo } from '@/mocks/legal';
import type {
  AcceptanceInput,
  AcceptanceStatus,
  CompanyInfo,
  ContactRequestInput,
  ContactRequestResult,
  LegalDocument,
  LegalDocumentType,
  WithdrawalRequestInput,
  WithdrawalRequestResult,
} from '@/types/legal';

import { codeLegalDocumentNotFound, hasCode } from './api-error';
import type { ApiLegalService } from './legal.api-service';
import type { LegalService } from '../legal.service';

/**
 * Presents the real `/legal/*` endpoints under the contract the legal screens
 * already consume (`docs/fichas-legal-backend.md`, BE 15/08).
 *
 * Two members need explicit handling rather than a straight pass-through:
 *
 * - `getCurrentDocument`: the API answers `404 legal_document_not_found` when
 *   a valid `tipo` has no version in force. That is a real, calm outcome —
 *   the page shows "todavía no está publicado" — so it maps to `undefined`,
 *   matching the mock. Every other failure still propagates and the screen
 *   shows its error state with a retry.
 *
 * - `getCompanyInfo`: has no endpoint. Razón social, CUIT and domicilio are
 *   still pending from Administración (instructivo §5), so this keeps
 *   serving the same all-null record the mock does, and `CompanyDetails`
 *   keeps rendering "Dato pendiente de publicación". Inventing values here
 *   would put fake company data on a page that exists to publish the real
 *   ones. When Administración delivers, this is where a real source plugs in.
 */
export function createBackedLegalService(api: ApiLegalService): LegalService {
  return {
    async getCurrentDocument(tipo: LegalDocumentType): Promise<LegalDocument | undefined> {
      try {
        return await api.getCurrentDocument(tipo);
      } catch (error) {
        if (hasCode(error, codeLegalDocumentNotFound)) {
          return undefined;
        }
        throw error;
      }
    },

    registerAcceptance(input: AcceptanceInput): Promise<void> {
      return api.registerAcceptance(input);
    },

    getAcceptanceStatus(): Promise<AcceptanceStatus> {
      return api.getAcceptanceStatus();
    },

    requestWithdrawal(input: WithdrawalRequestInput): Promise<WithdrawalRequestResult> {
      return api.requestWithdrawal(input);
    },

    requestContact(input: ContactRequestInput): Promise<ContactRequestResult> {
      return api.requestContact(input);
    },

    async getCompanyInfo(): Promise<CompanyInfo> {
      return mockCompanyInfo;
    },
  };
}
