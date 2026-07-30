import { generateMockCaseId, generateMockCode, generateMockInvitationId, generateMockInvitationLink } from '../utils/mock-id';
import type {
  CaseDetail,
  CaseInvitation,
  CaseSummary,
  CreateCaseInput,
  CreateInvitationInput,
} from '../types/case';
import { mockCaseDetails, mockCases } from '../mocks/cases';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { createBackedCasesService } from './api/cases.backed-service';
import { backend } from './backend-instance';

/**
 * Replaceable service boundary for the Casos feature. Phase 1/2 ship only
 * `createMockCasesService` (typed mock data, simulated network/AI latency,
 * in-memory-only persistence for the current app session). A future
 * `createApiCasesService` implementing the same interface against
 * `apps/api` is a drop-in replacement — no call site outside this file
 * should know which implementation is active.
 */
export type CasesService = {
  listCases(): Promise<CaseSummary[]>;
  getCaseDetail(caseId: string): Promise<CaseDetail | undefined>;
  createCase(input: CreateCaseInput): Promise<CaseSummary>;
  createInvitation(input: CreateInvitationInput): Promise<CaseInvitation>;
  getInvitation(caseId: string): Promise<CaseInvitation | null>;
  /**
   * Smallest possible lightweight lookup for other features (notices,
   * activity) that only need a safe display title for a caseId — never
   * caseCode, descripcion, or any other case-detail field. Returns null
   * when the case doesn't exist, so callers can render safely instead of
   * guessing at a title.
   */
  getCaseTitle(caseId: string): Promise<string | null>;
  /**
   * Frontend-only demo affordance (phase 9) — simulates the other party
   * accepting the invitation, since no real invitation-acceptance workflow
   * exists in this mock. Transitions `estado: 'nuevo' → 'activo'`, both
   * real, backend-aligned `estado_caso` values (`nuevo → activo` is a valid
   * transition per the backend's own `validate_caso_estado_transition`
   * trigger) — no new persisted status is invented. Only ever applies to a
   * case currently in the exact `'nuevo'` state; calling it again on an
   * already-transitioned case is a safe no-op that returns the current
   * detail unchanged, never an error. Creates no counterparty identity, no
   * token, no session — see CaseDetailScreen.tsx for the confirmation UI.
   */
  simulateInvitationAcceptance(caseId: string): Promise<CaseDetail>;
  /**
   * Redeems an invitation token as the calling user, joining them to the case
   * it belongs to. Backed by `POST /casos/unirse`.
   *
   * Returns the joined case so the caller can navigate straight to it —
   * `estado` comes back from the server because joining is what transitions a
   * case out of `nuevo`, and the screen should show the real value rather than
   * assume one.
   *
   * Rejects when the token is unknown, already redeemed, or past its TTL. The
   * server distinguishes those; a caller that only needs "it did not work" can
   * treat any rejection uniformly.
   */
  joinCase(token: string): Promise<JoinedCase>;
};

/** What `joinCase` resolves to — the shape `POST /casos/unirse` returns. */
export type JoinedCase = {
  id: string;
  estado: string;
};

/**
 * Dev/test-only forced-failure hook. Not imported by any screen or UI
 * component — there is no user-facing toggle. A future test file can call
 * `__mockForceNextFailure('createCase')` to exercise the recoverable-error
 * path without touching the normal success path used by everyone else.
 */
const failures = createFailureController<'createCase' | 'createInvitation' | 'simulateInvitationAcceptance'>();

export function __mockForceNextFailure(operation: 'createCase' | 'createInvitation' | 'simulateInvitationAcceptance'): void {
  failures.force(operation);
}

/** In-memory only — cleared on app restart, never written to disk. Keyed by caseId (one invitation per case for mock purposes). */
const mockInvitations: Record<string, CaseInvitation> = {};

export function createMockCasesService(): CasesService {
  return {
    async listCases() {
      return delay(mockCases, 600);
    },
    async getCaseDetail(caseId) {
      return delay(mockCaseDetails[caseId], 400);
    },
    async createCase(input) {
      if (failures.consume('createCase')) {
        return rejectAfter('mock_create_case_failed', 500);
      }

      const id = generateMockCaseId();
      const caseCode = `CASO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const summary: CaseSummary = {
        id,
        title: input.nombre,
        counterpartyName: null,
        estado: 'nuevo',
        metodo: input.metodo,
        roundNumber: null,
        visualStatus: 'info',
        statusLabelKey: 'awaitingCounterparty',
        slaHours: null,
      };

      const detail: CaseDetail = {
        ...summary,
        caseCode,
        descripcion: input.descripcion,
      };

      const created = await delay({ summary, detail }, 900);
      // Mutate the shared in-memory mock store so it's picked up by the next
      // listCases()/getCaseDetail() call — this is the entire persistence
      // model for this phase: session-only, cleared on restart.
      mockCases.push(created.summary);
      mockCaseDetails[id] = created.detail;
      return created.summary;
    },
    async createInvitation(input) {
      if (failures.consume('createInvitation')) {
        return rejectAfter('mock_create_invitation_failed', 500);
      }

      const invitation: CaseInvitation = {
        id: generateMockInvitationId(),
        caseId: input.casoId,
        tipo: input.tipo,
        token:
          input.tipo === 'link'
            ? generateMockInvitationLink()
            : input.tipo === 'codigo'
              ? generateMockCode()
              : null,
        emailDestino: input.tipo === 'email' ? (input.emailDestino ?? null) : null,
        estado: 'pendiente',
        createdAt: new Date().toISOString(),
      };

      const created = await delay(invitation, 700);
      mockInvitations[input.casoId] = created;
      return created;
    },
    async getInvitation(caseId) {
      return delay(mockInvitations[caseId] ?? null, 300);
    },
    async getCaseTitle(caseId) {
      const detail = mockCaseDetails[caseId];
      return delay(detail ? detail.title : null, 150);
    },

    async simulateInvitationAcceptance(caseId) {
      if (failures.consume('simulateInvitationAcceptance')) {
        return rejectAfter('mock_simulate_invitation_acceptance_failed', 500);
      }

      const detail = mockCaseDetails[caseId];
      if (!detail) return rejectAfter('case_not_found', 300);

      if (detail.estado !== 'nuevo') {
        // Already transitioned (or never awaiting) — return the current
        // detail safely, no mutation, no error. Idempotent by design.
        return delay(detail, 200);
      }

      // Build the complete next state before committing — no counterparty
      // identity, token, or user-entered text is ever involved.
      const updatedDetail: CaseDetail = { ...detail, estado: 'activo', statusLabelKey: 'inReview', visualStatus: 'info' };
      const committed = await delay(updatedDetail, 900);

      // Only mutate after the mock "request" resolves — a forced failure
      // above never leaves the case partially transitioned.
      mockCaseDetails[caseId] = committed;
      const summaryIndex = mockCases.findIndex((c) => c.id === caseId);
      if (summaryIndex !== -1) {
        mockCases[summaryIndex] = { ...mockCases[summaryIndex], estado: 'activo', statusLabelKey: 'inReview', visualStatus: 'info' };
      }

      return committed;
    },

    async joinCase(token) {
      const trimmed = token.trim();
      if (trimmed === '') {
        return rejectAfter('invitation_token_required', 200);
      }

      // Matched against invitations this mock actually issued. Accepting any
      // string would make the screen look like it works while proving nothing,
      // and a wrong token is the case most worth exercising.
      const match = Object.values(mockInvitations).find(
        (invitation) => invitation.token === trimmed,
      );
      if (!match) {
        return rejectAfter('invitation_not_found', 600);
      }

      // Joining is what moves a case out of 'nuevo', which is exactly the
      // transition simulateInvitationAcceptance already models. Reusing it keeps
      // one definition of that transition instead of two that can drift.
      const detail = await this.simulateInvitationAcceptance(match.caseId);
      return { id: detail.id, estado: detail.estado };
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
export const casesService: CasesService = backend
  ? createBackedCasesService(backend.cases)
  : createMockCasesService();
