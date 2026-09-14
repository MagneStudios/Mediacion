import { getOrCreateMockContext } from '../mocks/case-context';
import type {
  CaseContext,
  CaseContextSectionId,
} from '../types/case-context';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { backend } from './backend-instance';

export type CaseContextService = {
  getContext(caseId: string): Promise<CaseContext>;
  saveSection<K extends CaseContextSectionId>(
    caseId: string,
    sectionId: K,
    entries: CaseContext[K],
  ): Promise<CaseContext>;
};

const MOCK_OWNER_ID = 'party-self';

const failures = createFailureController<'getContext' | 'saveSection'>();

export function __mockForceCaseContextFailure(
  operation: 'getContext' | 'saveSection',
): void {
  failures.force(operation);
}

const SECTION_DEFAULT_VISIBILITY: Record<CaseContextSectionId, 'shared' | 'private'> = {
  integrantes: 'shared',
  actividades: 'shared',
  colegio: 'shared',
  cronograma: 'shared',
  domicilios: 'private',
  restricciones: 'private',
};

function computeCompletedSections(ctx: CaseContext): CaseContextSectionId[] {
  const completed: CaseContextSectionId[] = [];
  if (ctx.integrantes.length > 0) completed.push('integrantes');
  if (ctx.actividades.length > 0) completed.push('actividades');
  if (ctx.colegio !== null) completed.push('colegio');
  if (ctx.cronograma.length > 0) completed.push('cronograma');
  if (ctx.domicilios.length > 0) completed.push('domicilios');
  if (ctx.restricciones.length > 0) completed.push('restricciones');
  return completed;
}

export function createMockCaseContextService(): CaseContextService {
  return {
    async getContext(caseId) {
      if (failures.consume('getContext')) {
        return rejectAfter('mock_get_context_failed', 500);
      }
      const ctx = getOrCreateMockContext(caseId);
      return delay({ ...ctx }, 300);
    },

    async saveSection(caseId, sectionId, entries) {
      if (failures.consume('saveSection')) {
        return rejectAfter('mock_save_section_failed', 500);
      }

      const ctx = getOrCreateMockContext(caseId);

      if (sectionId === 'colegio') {
        const entry = entries as CaseContext['colegio'];
        if (entry && !entry.ownerId) {
          (entry as any).ownerId = MOCK_OWNER_ID;
        }
        if (entry && !entry.visibility) {
          (entry as any).visibility = SECTION_DEFAULT_VISIBILITY[sectionId];
        }
        ctx.colegio = entry;
      } else {
        const arr = entries as Array<{ ownerId?: string; visibility?: 'shared' | 'private'; [key: string]: unknown }>;
        const normalized = arr.map((entry) => ({
          ...entry,
          ownerId: entry.ownerId ?? MOCK_OWNER_ID,
          visibility: entry.visibility ?? SECTION_DEFAULT_VISIBILITY[sectionId],
        }));
        (ctx as any)[sectionId] = normalized;
      }

      ctx.completedSections = computeCompletedSections(ctx);

      return delay({ ...ctx }, 500);
    },
  };
}

export const caseContextService: CaseContextService = backend
  ? (backend as any).caseContext
  : createMockCaseContextService();
