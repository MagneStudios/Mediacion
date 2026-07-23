import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { CategoriaPosicion } from '../../../types/position';

export type PositionDraft = {
  category: CategoriaPosicion | null;
  name: string;
  description: string;
  valueMin: string;
  valueMax: string;
  canConcede: boolean | null;
  concessionConditions: string;
};

const emptyDraft: PositionDraft = {
  category: null,
  name: '',
  description: '',
  valueMin: '',
  valueMax: '',
  canConcede: null,
  concessionConditions: '',
};

type PositionDraftContextValue = {
  draft: PositionDraft;
  setCategory: (category: CategoriaPosicion) => void;
  setBasicInfo: (name: string, description: string) => void;
  setRange: (valueMin: string, valueMax: string) => void;
  setConcession: (canConcede: boolean, concessionConditions: string) => void;
  reset: () => void;
};

const PositionDraftContext = createContext<PositionDraftContextValue | undefined>(undefined);

/**
 * Draft state for the create → review position wizard (app/case/[id]/positions/*).
 * Scoped to that route group's layout, same pattern as CaseCreationProvider —
 * starts fresh every time the flow is entered, discarded automatically if
 * abandoned, no global state-management dependency needed. Never held in
 * navigation params — this is the only place the in-progress private values
 * live before they're saved.
 */
export function PositionDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PositionDraft>(emptyDraft);

  const setCategory = useCallback((category: CategoriaPosicion) => {
    setDraft((prev) => ({ ...prev, category }));
  }, []);

  const setBasicInfo = useCallback((name: string, description: string) => {
    setDraft((prev) => ({ ...prev, name, description }));
  }, []);

  const setRange = useCallback((valueMin: string, valueMax: string) => {
    setDraft((prev) => ({ ...prev, valueMin, valueMax }));
  }, []);

  const setConcession = useCallback((canConcede: boolean, concessionConditions: string) => {
    setDraft((prev) => ({ ...prev, canConcede, concessionConditions }));
  }, []);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
  }, []);

  const value = useMemo(
    () => ({ draft, setCategory, setBasicInfo, setRange, setConcession, reset }),
    [draft, setCategory, setBasicInfo, setRange, setConcession, reset],
  );

  return <PositionDraftContext.Provider value={value}>{children}</PositionDraftContext.Provider>;
}

export function usePositionDraft(): PositionDraftContextValue {
  const context = useContext(PositionDraftContext);
  if (!context) {
    throw new Error('usePositionDraft must be used within a PositionDraftProvider');
  }
  return context;
}
