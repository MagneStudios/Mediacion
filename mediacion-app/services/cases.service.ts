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
};

/**
 * Dev/test-only forced-failure hook. Not imported by any screen or UI
 * component — there is no user-facing toggle. A future test file can call
 * `__mockForceNextFailure('createCase')` to exercise the recoverable-error
 * path without touching the normal success path used by everyone else.
 */
const failures = createFailureController<'createCase' | 'createInvitation'>();

export function __mockForceNextFailure(operation: 'createCase' | 'createInvitation'): void {
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
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
export const casesService: CasesService = createMockCasesService();
