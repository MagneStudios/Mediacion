import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { caseContextService } from '../../../services/case-context.service';
import type {
  CaseContext,
  CaseContextSectionId,
} from '../../../types/case-context';

type CaseContextDraftContextValue = {
  draft: CaseContext | null;
  status: 'idle' | 'loading' | 'saving' | 'error';
  load: (caseId: string) => Promise<void>;
  saveSection: <K extends CaseContextSectionId>(
    caseId: string,
    sectionId: K,
    entries: CaseContext[K],
  ) => Promise<CaseContext>;
  reset: () => void;
};

const CaseContextDraftContext = createContext<CaseContextDraftContextValue | undefined>(undefined);

export function CaseContextDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CaseContext | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle');

  const load = useCallback(async (caseId: string) => {
    setStatus('loading');
    try {
      const ctx = await caseContextService.getContext(caseId);
      setDraft(ctx);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  const saveSection = useCallback(
    async <K extends CaseContextSectionId>(
      caseId: string,
      sectionId: K,
      entries: CaseContext[K],
    ): Promise<CaseContext> => {
      setStatus('saving');
      try {
        const updated = await caseContextService.saveSection(caseId, sectionId, entries);
        setDraft(updated);
        setStatus('idle');
        return updated;
      } catch {
        setStatus('error');
        throw new Error('mock_save_section_failed');
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setDraft(null);
    setStatus('idle');
  }, []);

  const value = useMemo(
    () => ({ draft, status, load, saveSection, reset }),
    [draft, status, load, saveSection, reset],
  );

  return <CaseContextDraftContext.Provider value={value}>{children}</CaseContextDraftContext.Provider>;
}

export function useCaseContextDraft(): CaseContextDraftContextValue {
  const context = useContext(CaseContextDraftContext);
  if (!context) {
    throw new Error('useCaseContextDraft must be used within a CaseContextDraftProvider');
  }
  return context;
}

export function useCaseContext(caseId: string) {
  const { draft, status, load } = useCaseContextDraft();

  useEffect(() => {
    void load(caseId);
  }, [caseId, load]);

  return { draft, status };
}
