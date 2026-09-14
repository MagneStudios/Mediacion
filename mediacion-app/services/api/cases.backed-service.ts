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
 * There used to be a session-scoped map here that patched `pagoACargo` onto
 * the server's answer, because `GET /casos/:id/invitaciones` did not select
 * that column. It does since 10/09 — the read is a plain server read now,
 * nothing local left to remember.
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

    createInvitation(input: CreateInvitationInput): Promise<CaseInvitation> {
      return api.createInvitation(input);
    },

    /**
     * The newest still-pending invitation of the caso, read straight from the
     * server. `null` means "nothing to re-show" — no invitation, or none
     * still pending. Every other failure propagates, so the screen renders
     * its error state with a retry instead of a button that quietly does
     * nothing.
     */
    async getInvitation(caseId: string): Promise<CaseInvitation | null> {
      const invitations = await api.listInvitations(caseId);
      return invitations.find((invitation) => invitation.estado === estadoPendiente) ?? null;
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

    /**
     * RN-10 y RN-08 pasan derecho a la API: no hay nada que adaptar entre lo
     * que la pantalla pide y lo que el servidor acepta, y ninguna de las dos
     * devuelve un caso que haya que mapear.
     */
    setCaseDeadline(caseId: string, plazo: string): Promise<void> {
      return api.setCaseDeadline(caseId, plazo);
    },

    terminateCase(caseId: string): Promise<void> {
      return api.terminateCase(caseId);
    },

    joinCase(token: string): Promise<JoinedCase> {
      return api.joinCase(token);
    },
  };
}
