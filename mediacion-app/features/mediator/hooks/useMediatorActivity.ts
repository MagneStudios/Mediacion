import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { mediatorService } from '../../../services/mediator.service';
import type { MediatorActivityItem } from '../../../types/mediator';

export type FetchStatus = 'loading' | 'error' | 'success';

/** Case-scoped mediator milestone feed. Mirrors useActivity()'s fetch/focus-refresh shape — read-only, no mutations. */
export function useMediatorActivity(caseId: string) {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [items, setItems] = useState<MediatorActivityItem[]>([]);
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
    mediatorService
      .getMediatorActivity(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setItems(result);
        setStatus('success');
      })
      .catch(() => {
        // A focus refresh is best-effort: keep the last successful activity.
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    mediatorService
      .getMediatorActivity(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setItems(result);
        setStatus('success');
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

  return {
    status: resultCaseId === caseId ? status : 'loading',
    items: resultCaseId === caseId && status === 'success' ? items : [],
    reload,
  };
}
