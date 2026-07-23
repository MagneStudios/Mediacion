import type { AiProposal, CaseDetail, CaseSummary } from '../types/case';
import { mockCaseDetails, mockCases } from '../mocks/cases';

/**
 * Replaceable service boundary for the Casos feature. Phase 1 ships only
 * `createMockCasesService` (typed mock data, simulated network/AI latency).
 * A future `createApiCasesService` implementing the same interface against
 * `apps/api` is a drop-in replacement — no call site outside this file
 * should know which implementation is active.
 */
export type CasesService = {
  listCases(): Promise<CaseSummary[]>;
  getCaseDetail(caseId: string): Promise<CaseDetail | undefined>;
  generateAiProposal(caseId: string): Promise<AiProposal>;
};

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function createMockCasesService(): CasesService {
  return {
    async listCases() {
      return delay(mockCases, 600);
    },
    async getCaseDetail(caseId) {
      return delay(mockCaseDetails[caseId], 400);
    },
    async generateAiProposal(caseId) {
      return delay(
        {
          id: `proposal-${caseId}-${Date.now()}`,
          caseId,
          estado: 'pendiente',
          summary:
            'Calendario alterno semanal con entrega los viernes. Vacaciones por mitades y revisión a los seis meses.',
          generatedAt: new Date().toISOString(),
        },
        1800,
      );
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
export const casesService: CasesService = createMockCasesService();
