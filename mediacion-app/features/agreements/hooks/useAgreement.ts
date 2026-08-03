import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { agreementsService } from '../../../services/agreements.service';
import type { AgreementState } from '../../../types/agreement';

export type FetchStatus = 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * Agreement state for one case, plus the two mutations available on it.
 * Mirrors useNegotiation()'s fetch/focus-refresh shape. `state` is `null`
 * when the case has no accepted proposal yet — a calm, expected read, not
 * an error.
 */
export function useAgreement(caseId: string) {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [state, setState] = useState<AgreementState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);
  const activeCaseIdRef = useRef(caseId);
  const mountedRef = useRef(true);
  const prepareInFlightRef = useRef<object | null>(null);
  const signInFlightRef = useRef<object | null>(null);
  const mutationRevisionRef = useRef(0);
  const [resultCaseId, setResultCaseId] = useState<string | null>(null);

  const [prepareStatus, setPrepareStatus] = useState<MutationStatus>('idle');
  const [signStatus, setSignStatus] = useState<MutationStatus>('idle');

  if (activeCaseIdRef.current !== caseId) {
    activeCaseIdRef.current = caseId;
    mutationRevisionRef.current += 1;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    prepareInFlightRef.current = null;
    signInFlightRef.current = null;
    setPrepareStatus('idle');
    setSignStatus('idle');
  }, [caseId]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    const revision = mutationRevisionRef.current;
    if (prepareInFlightRef.current || signInFlightRef.current) return;
    agreementsService
      .getAgreementState(caseId)
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
    agreementsService
      .getAgreementState(caseId)
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

  const prepareDocument = useCallback(async () => {
    if (prepareInFlightRef.current) return;
    const operation = {};
    prepareInFlightRef.current = operation;
    mutationRevisionRef.current += 1;
    setPrepareStatus('pending');
    try {
      const result = await agreementsService.prepareSignatureDocument(caseId);
      if (!mountedRef.current || activeCaseIdRef.current !== caseId) return;
      setResultCaseId(caseId);
      setState(result);
      setPrepareStatus('idle');
    } catch {
      if (mountedRef.current && activeCaseIdRef.current === caseId) setPrepareStatus('error');
    } finally {
      if (prepareInFlightRef.current === operation) prepareInFlightRef.current = null;
    }
  }, [caseId]);

  const submitSignature = useCallback(
    async (agreementId: string) => {
      if (signInFlightRef.current) return;
      const operation = {};
      signInFlightRef.current = operation;
      mutationRevisionRef.current += 1;
      setSignStatus('pending');
      try {
        const result = await agreementsService.submitOwnMockSignature(caseId, agreementId);
        if (!mountedRef.current || activeCaseIdRef.current !== caseId) return;
        setResultCaseId(caseId);
        setState(result);
        setSignStatus('idle');
      } catch {
        if (mountedRef.current && activeCaseIdRef.current === caseId) setSignStatus('error');
      } finally {
        if (signInFlightRef.current === operation) signInFlightRef.current = null;
      }
    },
    [caseId],
  );

  const resetSignStatus = useCallback(() => {
    setSignStatus('idle');
  }, []);

  return {
    status: resultCaseId === caseId ? status : 'loading',
    state: resultCaseId === caseId ? state : null,
    reload,
    prepareStatus,
    prepareDocument,
    signStatus,
    submitSignature,
    resetSignStatus,
  };
}
