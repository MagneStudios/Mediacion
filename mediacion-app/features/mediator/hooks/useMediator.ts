import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { mediatorService } from '../../../services/mediator.service';
import type { MediatorState } from '../../../types/mediator';

export type FetchStatus = 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * Mediator-accompaniment state for one case, plus the single mutation
 * available in this phase (requestMediator — there is no cancel). Mirrors
 * useNegotiation()'s fetch/focus-refresh shape. `state` is null both while
 * loading and when the case doesn't exist — callers distinguish the two
 * via `status`.
 */
export function useMediator(caseId: string) {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [state, setState] = useState<MediatorState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const [requestStatus, setRequestStatus] = useState<MutationStatus>('idle');

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    mediatorService.getMediatorState(caseId).then((result) => {
      if (cancelled) return;
      setState(result);
      setStatus('success');
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
      .getMediatorState(caseId)
      .then((result) => {
        if (cancelled) return;
        setState(result);
        setStatus('success');
        hasLoadedOnceRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
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

  /** Duplicate submissions are a guarded no-op — a second call while one is already in flight does nothing. */
  const requestMediator = useCallback(async () => {
    if (requestStatus === 'pending') return;
    setRequestStatus('pending');
    try {
      const result = await mediatorService.requestMediator(caseId);
      setState(result);
      setRequestStatus('idle');
    } catch {
      setRequestStatus('error');
    }
  }, [caseId, requestStatus]);

  /** Call when opening a fresh confirmation dialog, so a previous attempt's error doesn't appear to already apply to this one. */
  const resetRequestStatus = useCallback(() => {
    setRequestStatus('idle');
  }, []);

  return { status, state, reload, requestStatus, requestMediator, resetRequestStatus };
}
