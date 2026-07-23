import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { CaseInvitation, MetodoCaso } from '../../../types/case';

export type CaseCreationDraft = {
  nombre: string;
  descripcion: string;
  metodo: MetodoCaso | null;
  caseId: string | null;
  invitation: CaseInvitation | null;
};

const emptyDraft: CaseCreationDraft = {
  nombre: '',
  descripcion: '',
  metodo: null,
  caseId: null,
  invitation: null,
};

type CaseCreationContextValue = {
  draft: CaseCreationDraft;
  setBasicInfo: (nombre: string, descripcion: string) => void;
  setMetodo: (metodo: MetodoCaso) => void;
  setCreatedCase: (caseId: string) => void;
  setInvitationResult: (invitation: CaseInvitation) => void;
  reset: () => void;
};

const CaseCreationContext = createContext<CaseCreationContextValue | undefined>(undefined);

/**
 * Draft state for the case-creation wizard (app/case/create/*). Scoped to
 * that route group's layout so it starts fresh every time the flow is
 * entered and is discarded automatically if the flow is abandoned — no
 * global state-management dependency needed for a five-screen wizard.
 */
export function CaseCreationProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CaseCreationDraft>(emptyDraft);

  const setBasicInfo = useCallback((nombre: string, descripcion: string) => {
    setDraft((prev) => ({ ...prev, nombre, descripcion }));
  }, []);

  const setMetodo = useCallback((metodo: MetodoCaso) => {
    setDraft((prev) => ({ ...prev, metodo }));
  }, []);

  const setCreatedCase = useCallback((caseId: string) => {
    setDraft((prev) => ({ ...prev, caseId }));
  }, []);

  const setInvitationResult = useCallback((invitation: CaseInvitation) => {
    setDraft((prev) => ({ ...prev, invitation }));
  }, []);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
  }, []);

  const value = useMemo(
    () => ({ draft, setBasicInfo, setMetodo, setCreatedCase, setInvitationResult, reset }),
    [draft, setBasicInfo, setMetodo, setCreatedCase, setInvitationResult, reset],
  );

  return <CaseCreationContext.Provider value={value}>{children}</CaseCreationContext.Provider>;
}

export function useCaseCreationFlow(): CaseCreationContextValue {
  const context = useContext(CaseCreationContext);
  if (!context) {
    throw new Error('useCaseCreationFlow must be used within a CaseCreationProvider');
  }
  return context;
}
