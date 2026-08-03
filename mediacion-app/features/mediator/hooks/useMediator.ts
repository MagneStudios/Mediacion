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
  const activeCaseIdRef = useRef(caseId);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef<object | null>(null);
  const mutationRevisionRef = useRef(0);
  const [resultCaseId, setResultCaseId] = useState<string | null>(null);

  const [requestStatus, setRequestStatus] = useState<MutationStatus>('idle');

  if (activeCaseIdRef.current !== caseId) {
    activeCaseIdRef.current = caseId;
    hasLoadedOnceRef.current = false;
    mutationRevisionRef.current += 1;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    requestInFlightRef.current = null;
    setRequestStatus('idle');
  }, [caseId]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    const revision = mutationRevisionRef.current;
    if (requestInFlightRef.current) return;
    mediatorService
      .getMediatorState(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId || mutationRevisionRef.current !== revision) return;
        setResultCaseId(caseId);
        setState(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled || activeCaseIdRef.current !== caseId || mutationRevisionRef.current !== revision) return;
        setResultCaseId(caseId);
        setStatus('error');
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
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setState(result);
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

  /** Duplicate submissions are a guarded no-op — a second call while one is already in flight does nothing. */
  const requestMediator = useCallback(async () => {
    if (requestInFlightRef.current) return false;
    const operation = {};
    requestInFlightRef.current = operation;
    mutationRevisionRef.current += 1;
    setRequestStatus('pending');
    try {
      const result = await mediatorService.requestMediator(caseId);
      if (!mountedRef.current || activeCaseIdRef.current !== caseId) return false;
      setResultCaseId(caseId);
      setState(result);
      setStatus('success');
      setRequestStatus('idle');
      return true;
    } catch {
      if (mountedRef.current && activeCaseIdRef.current === caseId) setRequestStatus('error');
      return false;
    } finally {
      if (requestInFlightRef.current === operation) requestInFlightRef.current = null;
    }
  }, [caseId]);

  /** Call when opening a fresh confirmation dialog, so a previous attempt's error doesn't appear to already apply to this one. */
  const resetRequestStatus = useCallback(() => {
    setRequestStatus('idle');
  }, []);

  return {
    status: resultCaseId === caseId ? status : 'loading',
    state: resultCaseId === caseId ? state : null,
    reload,
    requestStatus,
    requestMediator,
    resetRequestStatus,
  };
}
