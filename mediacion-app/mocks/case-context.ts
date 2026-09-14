import type { CaseContext } from '../types/case-context';

export const mockCaseContexts: Record<string, CaseContext> = {};

export function getOrCreateMockContext(caseId: string): CaseContext {
  if (!mockCaseContexts[caseId]) {
    mockCaseContexts[caseId] = {
      caseId,
      integrantes: [],
      actividades: [],
      colegio: null,
      cronograma: [],
      domicilios: [],
      restricciones: [],
      completedSections: [],
    };
  }
  return mockCaseContexts[caseId];
}
