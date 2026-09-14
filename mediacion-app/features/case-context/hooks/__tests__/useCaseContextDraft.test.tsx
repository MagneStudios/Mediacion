import { renderHook, act, waitFor } from '@testing-library/react-native';

import { CaseContextDraftProvider, useCaseContextDraft } from '../useCaseContextDraft';

jest.mock('@/services/case-context.service', () => {
  const mockContext = {
    caseId: 'case-1',
    integrantes: [],
    actividades: [],
    colegio: null,
    cronograma: [],
    domicilios: [],
    restricciones: [],
    completedSections: [],
  };
  return {
    caseContextService: {
      getContext: jest.fn().mockResolvedValue(mockContext),
      saveSection: jest.fn().mockImplementation(async (_caseId: string, sectionId: string, entries: unknown) => ({
        ...mockContext,
        [sectionId]: entries,
        completedSections: Array.isArray(entries) && (entries as unknown[]).length > 0 ? [sectionId] : [],
      })),
    },
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <CaseContextDraftProvider>{children}</CaseContextDraftProvider>;
}

describe('useCaseContextDraft', () => {
  it('loads context on demand', async () => {
    const { result } = await renderHook(() => useCaseContextDraft(), { wrapper });

    await act(async () => {
      await result.current.load('case-1');
    });

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });
    expect(result.current.draft?.caseId).toBe('case-1');
  });

  it('saves a section and updates draft', async () => {
    const { result } = await renderHook(() => useCaseContextDraft(), { wrapper });

    await act(async () => {
      await result.current.load('case-1');
    });

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    const entries = [
      { data: { id: 'm1', nombre: 'Ana', parentesco: 'hija' }, ownerId: 'party-self' },
    ];

    await act(async () => {
      await result.current.saveSection('case-1', 'integrantes', entries);
    });

    await waitFor(() => {
      expect(result.current.draft?.integrantes).toHaveLength(1);
    });
    expect(result.current.draft?.completedSections).toContain('integrantes');
  });

  it('resets draft to null', async () => {
    const { result } = await renderHook(() => useCaseContextDraft(), { wrapper });

    await act(async () => {
      await result.current.load('case-1');
    });

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    await act(async () => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.draft).toBeNull();
    });
  });
});
