import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { negotiationService } from '../../../services/negotiation.service';
import type { RoundHistoryItem } from '../../../types/negotiation';

export type UseRoundHistoryResult =
  | { status: 'loading'; items: undefined }
  | { status: 'error'; items: undefined; reload: () => void }
  | { status: 'empty'; items: [] }
  | { status: 'success'; items: RoundHistoryItem[] };

/** Read-only completed-round history for one case. */
export function useRoundHistory(caseId: string): UseRoundHistoryResult {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [items, setItems] = useState<RoundHistoryItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);
  const activeCaseIdRef = useRef(caseId);
  const [resultCaseId, setResultCaseId] = useState<string | null>(null);

  if (activeCaseIdRef.current !== caseId) {
    activeCaseIdRef.current = caseId;
    hasLoadedOnceRef.current = false;
  }

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    negotiationService
      .getRoundHistory(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setItems(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
      })
      .catch(() => {
        // A focus refresh is best-effort: keep the last successful history.
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
      .getRoundHistory(caseId)
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

  if (resultCaseId !== caseId || status === 'loading') return { status: 'loading', items: undefined };
  if (status === 'error') return { status, items: undefined, reload };
  if (status === 'empty') return { status, items: [] };
  return { status, items };
}
