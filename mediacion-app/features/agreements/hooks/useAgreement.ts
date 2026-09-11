import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { agreementsService } from '../../../services/agreements.service';
import type { AgreementState } from '../../../types/agreement';

export type FetchStatus = 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * Agreement state for one case, plus the three mutations that replace it:
 * preparing the document, signing, and registering a breach notice — the last
 * one because the server moves the acuerdo to `con_aviso` in the same
 * transaction, so it returns a new state just like the other two.
 * Mirrors useNegotiation()'s fetch/focus-refresh shape. `state` is `null`
 * when the case has no accepted proposal yet — a calm, expected read, not
 * an error.
 */
export function useAgreement(caseId: string, agreementId?: string) {
  /**
   * Identidad de lo que esta pantalla muestra. Con `agreementId` es el
   * acuerdo; sin él, "el acuerdo del caso" — correcto mientras haya uno. Un
   * `agreementId` distinto con el mismo `caseId` es otro documento y no
   * comparte estado, resultado ni mutaciones en vuelo con el anterior.
   */
  const key = agreementId ?? caseId;
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [state, setState] = useState<AgreementState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);
  const activeKeyRef = useRef(key);
  const mountedRef = useRef(true);
  const prepareInFlightRef = useRef<object | null>(null);
  const signInFlightRef = useRef<object | null>(null);
  const breachInFlightRef = useRef<object | null>(null);
  const mutationRevisionRef = useRef(0);
  const [resultKey, setResultKey] = useState<string | null>(null);

  const [prepareStatus, setPrepareStatus] = useState<MutationStatus>('idle');
  const [signStatus, setSignStatus] = useState<MutationStatus>('idle');
  const [breachStatus, setBreachStatus] = useState<MutationStatus>('idle');

  if (activeKeyRef.current !== key) {
    activeKeyRef.current = key;
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
    breachInFlightRef.current = null;
    setPrepareStatus('idle');
    setSignStatus('idle');
    setBreachStatus('idle');
  }, [key]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const read = useCallback(
    () =>
      agreementId === undefined
        ? agreementsService.getAgreementState(caseId)
        : agreementsService.getAgreementStateById(agreementId),
    [caseId, agreementId],
  );

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    const revision = mutationRevisionRef.current;
    if (prepareInFlightRef.current || signInFlightRef.current || breachInFlightRef.current) return;
    read()
      .then((result) => {
        if (cancelled || activeKeyRef.current !== key || mutationRevisionRef.current !== revision) return;
        setResultKey(key);
        setState(result);
        setStatus('success');
      })
      .catch(() => {
        // A focus refresh is best-effort: keep the last successful state.
      });
    return () => {
      cancelled = true;
    };
  }, [key, read]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    read()
      .then((result) => {
        if (cancelled || activeKeyRef.current !== key) return;
        setResultKey(key);
        setState(result);
        setStatus('success');
        hasLoadedOnceRef.current = true;
      })
      .catch(() => {
        if (cancelled || activeKeyRef.current !== key) return;
        setResultKey(key);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [key, read, attempt]);

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
      const result = await agreementsService.prepareSignatureDocument(caseId, agreementId);
      if (!mountedRef.current || activeKeyRef.current !== key) return;
      setResultKey(key);
      setState(result);
      setPrepareStatus('idle');
    } catch {
      if (mountedRef.current && activeKeyRef.current === key) setPrepareStatus('error');
    } finally {
      if (prepareInFlightRef.current === operation) prepareInFlightRef.current = null;
    }
  }, [caseId, agreementId, key]);

  const submitSignature = useCallback(
    async (signedAgreementId: string) => {
      if (signInFlightRef.current) return;
      const operation = {};
      signInFlightRef.current = operation;
      mutationRevisionRef.current += 1;
      setSignStatus('pending');
      try {
        const result = await agreementsService.submitOwnMockSignature(caseId, signedAgreementId);
        if (!mountedRef.current || activeKeyRef.current !== key) return;
        setResultKey(key);
        setState(result);
        setSignStatus('idle');
      } catch {
        if (mountedRef.current && activeKeyRef.current === key) setSignStatus('error');
      } finally {
        if (signInFlightRef.current === operation) signInFlightRef.current = null;
      }
    },
    [caseId, key],
  );

  /**
   * Registering a breach also moves the agreement to `con_aviso` server-side,
   * so the service answers with the state afterwards and it replaces the one
   * on screen — exactly like a signature. Same in-flight guard: a double
   * confirm must not register the same notice twice.
   */
  const reportBreach = useCallback(
    async (breachedAgreementId: string, description: string) => {
      if (breachInFlightRef.current) return false;
      const operation = {};
      breachInFlightRef.current = operation;
      mutationRevisionRef.current += 1;
      setBreachStatus('pending');
      try {
        const result = await agreementsService.reportBreach(caseId, breachedAgreementId, description);
        if (!mountedRef.current || activeKeyRef.current !== key) return false;
        setResultKey(key);
        setState(result);
        setBreachStatus('idle');
        return true;
      } catch {
        if (mountedRef.current && activeKeyRef.current === key) setBreachStatus('error');
        return false;
      } finally {
        if (breachInFlightRef.current === operation) breachInFlightRef.current = null;
      }
    },
    [caseId, key],
  );

  const resetBreachStatus = useCallback(() => {
    setBreachStatus('idle');
  }, []);

  const resetSignStatus = useCallback(() => {
    setSignStatus('idle');
  }, []);

  return {
    status: resultKey === key ? status : 'loading',
    state: resultKey === key ? state : null,
    reload,
    prepareStatus,
    prepareDocument,
    signStatus,
    submitSignature,
    resetSignStatus,
    breachStatus,
    reportBreach,
    resetBreachStatus,
  };
}
