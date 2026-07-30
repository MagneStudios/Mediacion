import type {
  CaseDetail,
  CaseInvitation,
  CaseSummary,
  CreateCaseInput,
  CreateInvitationInput,
} from '@/types/case';

import type { CasesService } from '../cases.service';
import type { ApiCasesService } from './cases.api-service';

/**
 * Presents the real API under the same contract the screens already consume, so
 * no screen changes when the backend is configured.
 *
 * Two methods on `CasesService` have no server counterpart. Neither is faked:
 *
 * - `getInvitation` — the API exposes only `POST /casos/:id/invitaciones`, with
 *   no read endpoint. The only invitation this app can truthfully report is one
 *   it just created, so those are remembered for the session and anything else
 *   answers null, which every caller already handles.
 *
 * - `simulateInvitationAcceptance` — nothing is simulated against a real
 *   backend. The mock defines it as "a safe no-op that returns the current
 *   detail unchanged", which is precisely a re-read: if the counterparty really
 *   joined through `POST /casos/unirse`, the estado already changed server-side
 *   on its own.
 */
export function createBackedCasesService(api: ApiCasesService): CasesService {
  // Keyed by casoId. Deliberately in-memory and session-scoped: persisting it
  // would start a second source of truth for something the server owns.
  const createdInvitations = new Map<string, CaseInvitation>();

  return {
    listCases(): Promise<CaseSummary[]> {
      return api.listCases();
    },

    getCaseDetail(caseId: string): Promise<CaseDetail | undefined> {
      return api.getCaseDetail(caseId);
    },

    createCase(input: CreateCaseInput): Promise<CaseSummary> {
      return api.createCase(input);
    },

    async createInvitation(input: CreateInvitationInput): Promise<CaseInvitation> {
      // Recorded only after the API accepted it, so a rejected request leaves
      // nothing behind for getInvitation to report.
      const invitation = await api.createInvitation(input);
      createdInvitations.set(input.casoId, invitation);
      return invitation;
    },

    async getInvitation(caseId: string): Promise<CaseInvitation | null> {
      return createdInvitations.get(caseId) ?? null;
    },

    getCaseTitle(caseId: string): Promise<string | null> {
      return api.getCaseTitle(caseId);
    },

    async simulateInvitationAcceptance(caseId: string): Promise<CaseDetail> {
      const detail = await api.getCaseDetail(caseId);
      if (detail === undefined) {
        throw new Error(`Caso ${caseId} is no longer readable`);
      }
      return detail;
    },
  };
}
