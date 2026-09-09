import type {
  CaseDetail,
  CaseInvitation,
  CaseSummary,
  CreateCaseInput,
  CreateInvitationInput,
} from '@/types/case';

import type { CasesService, JoinedCase } from '../cases.service';
import type { ApiCasesService } from './cases.api-service';

/**
 * Presents the real API under the same contract the screens already consume, so
 * no screen changes when the backend is configured.
 *
 * `getInvitation` reads the server as of 25/08/2026. It used to answer only
 * with invitations created in this session, because the header here claimed
 * the API had no read endpoint — which stopped being true when
 * `GET /casos/:id/invitaciones` shipped (commit `32515a3`, 30/07). The visible
 * cost of that stale assumption: reloading the app made an invitation code
 * unrecoverable, and the only fix was issuing a second invitation.
 *
 * The session map stays, but demoted to one job — see `getInvitation`.
 *
 * One method on `CasesService` still has no server counterpart, and is not
 * faked:
 *
 * - `simulateInvitationAcceptance` — nothing is simulated against a real
 *   backend. The mock defines it as "a safe no-op that returns the current
 *   detail unchanged", which is precisely a re-read: if the counterparty really
 *   joined through `POST /casos/unirse`, the estado already changed server-side
 *   on its own.
 */
/** Only a pending invitation is worth re-showing: an accepted, rejected or
 * expired token cannot be used to join, and presenting one as "your invitation"
 * would send the counterparty into a dead end. */
const estadoPendiente: CaseInvitation['estado'] = 'pendiente';

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

    /**
     * The newest still-pending invitation of the caso, read from the server.
     *
     * The server owns the row; the session map contributes exactly one field,
     * `pagoACargo`, which `GET /casos/:id/invitaciones` does not return and
     * which we do know for an invitation we created in this session (we sent
     * it). It is matched **by invitation id**, not by caso: a second
     * invitation issued from another device must not inherit the payer choice
     * of the one this session created.
     *
     * `null` means "nothing to re-show" — no invitation, or none still
     * pending. Every other failure propagates, so the screen renders its error
     * state with a retry instead of a button that quietly does nothing.
     */
    async getInvitation(caseId: string): Promise<CaseInvitation | null> {
      const invitations = await api.listInvitations(caseId);
      const pending = invitations.find(
        (invitation) => invitation.estado === estadoPendiente,
      );
      if (pending === undefined) {
        return null;
      }
      const remembered = createdInvitations.get(caseId);
      return remembered?.id === pending.id
        ? { ...pending, pagoACargo: remembered.pagoACargo }
        : pending;
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

    joinCase(token: string): Promise<JoinedCase> {
      return api.joinCase(token);
    },
  };
}
