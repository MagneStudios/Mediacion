import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { negotiationService } from '../../../services/negotiation.service';
import type { Negotiation } from '../../../types/negotiation';

export type UseNegotiationsResult =
  | { status: 'loading'; items: undefined; reload: () => void }
  | { status: 'error'; items: undefined; reload: () => void }
  | { status: 'empty'; items: []; reload: () => void }
  | { status: 'success'; items: Negotiation[]; reload: () => void };

/**
 * Las negociaciones de un caso — una por materia — con su acuerdo vigente.
 * Misma forma que `useSignatureInbox`: carga inicial, refresh silencioso al
 * volver a la pantalla, y `reload` explícito para después de renegociar.
 *
 * `[]` es un estado normal (caso recién creado), no un error.
 */
export function useNegotiations(caseId: string): UseNegotiationsResult {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [items, setItems] = useState<Negotiation[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);
  const activeCaseIdRef = useRef(caseId);
  const [resultCaseId, setResultCaseId] = useState<string | null>(null);

  if (activeCaseIdRef.current !== caseId) {
    activeCaseIdRef.current = caseId;
  }

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    negotiationService
      .listNegotiations(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setItems(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
      })
      .catch(() => {
        // A focus refresh is best-effort: keep the last successful list.
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    negotiationService
      .listNegotiations(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setItems(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
        hasLoadedOnceRef.current = true;
      })
      .catch(() => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, attempt]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      return fetchSilently();
    }, [fetchSilently]),
  );

  if (resultCaseId !== caseId || status === 'loading') return { status: 'loading', items: undefined, reload };
  if (status === 'error') return { status, items: undefined, reload };
  if (status === 'empty') return { status, items: [], reload };
  return { status, items, reload };
}
