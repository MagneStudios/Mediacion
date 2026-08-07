import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { negotiationService } from '../../../services/negotiation.service';
import type { DecisionPropuesta, NegotiationState } from '../../../types/negotiation';

export type FetchStatus = 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * Negotiation state for one case, plus the three mutations available on it.
 * Mirrors useOwnPositions()'s fetch/focus-refresh shape. Each mutation keeps
 * its own local status — matching the explicit two-step model (starting a
 * round and generating a proposal are separate user actions, never one
 * button silently doing both).
 */
export function useNegotiation(caseId: string) {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [state, setState] = useState<NegotiationState | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);
  const activeCaseIdRef = useRef(caseId);
  const mountedRef = useRef(true);
  const startRoundInFlightRef = useRef<object | null>(null);
  const generateInFlightRef = useRef<object | null>(null);
  const respondInFlightRef = useRef<object | null>(null);
  const mutationRevisionRef = useRef(0);
  const [resultCaseId, setResultCaseId] = useState<string | null>(null);

  const [startRoundStatus, setStartRoundStatus] = useState<MutationStatus>('idle');
  const [generateStatus, setGenerateStatus] = useState<MutationStatus>('idle');
  const [respondStatus, setRespondStatus] = useState<MutationStatus>('idle');

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
    startRoundInFlightRef.current = null;
    generateInFlightRef.current = null;
    respondInFlightRef.current = null;
    setStartRoundStatus('idle');
    setGenerateStatus('idle');
    setRespondStatus('idle');
  }, [caseId]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    const revision = mutationRevisionRef.current;
    if (startRoundInFlightRef.current || generateInFlightRef.current || respondInFlightRef.current) return;
    negotiationService
      .getNegotiationState(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId || mutationRevisionRef.current !== revision) return;
        setResultCaseId(caseId);
        setState(result);
        setStatus('success');
      })
      .catch(() => {
        // A focus refresh is best-effort: keep the last successful state.
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    const revision = mutationRevisionRef.current;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    negotiationService
      .getNegotiationState(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId || mutationRevisionRef.current !== revision) return;
        setResultCaseId(caseId);
        setState(result);
        setStatus('success');
        hasLoadedOnceRef.current = true;
      })
      .catch(() => {
        if (cancelled || activeCaseIdRef.current !== caseId || mutationRevisionRef.current !== revision) return;
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

  const refreshAfterMutation = useCallback(async (revision: number) => {
    try {
      const result = await negotiationService.getNegotiationState(caseId);
      if (!mountedRef.current || activeCaseIdRef.current !== caseId || mutationRevisionRef.current !== revision) return false;
      setResultCaseId(caseId);
      setState(result);
      setStatus('success');
      return true;
    } catch {
      if (mountedRef.current && activeCaseIdRef.current === caseId && mutationRevisionRef.current === revision) {
        setResultCaseId(caseId);
        setStatus('error');
      }
      return false;
    }
  }, [caseId]);

  const startNextRound = useCallback(async () => {
    if (startRoundInFlightRef.current) return;
    const operation = {};
    startRoundInFlightRef.current = operation;
    mutationRevisionRef.current += 1;
    const revision = mutationRevisionRef.current;
    setStartRoundStatus('pending');
    try {
      await negotiationService.startNextRound(caseId);
      if (!mountedRef.current || activeCaseIdRef.current !== caseId || startRoundInFlightRef.current !== operation) return;
      setStartRoundStatus('idle');
      await refreshAfterMutation(revision);
    } catch {
      if (mountedRef.current && activeCaseIdRef.current === caseId && startRoundInFlightRef.current === operation) {
        setStartRoundStatus('error');
      }
    } finally {
      if (startRoundInFlightRef.current === operation) startRoundInFlightRef.current = null;
    }
  }, [caseId, refreshAfterMutation]);

  const generateProposal = useCallback(async () => {
    if (generateInFlightRef.current) return;
    const operation = {};
    generateInFlightRef.current = operation;
    mutationRevisionRef.current += 1;
    const revision = mutationRevisionRef.current;
    setGenerateStatus('pending');
    try {
      await negotiationService.generateSharedProposal(caseId);
      if (!mountedRef.current || activeCaseIdRef.current !== caseId || generateInFlightRef.current !== operation) return;
      setGenerateStatus('idle');
      await refreshAfterMutation(revision);
    } catch {
      if (mountedRef.current && activeCaseIdRef.current === caseId && generateInFlightRef.current === operation) {
        setGenerateStatus('error');
      }
    } finally {
      if (generateInFlightRef.current === operation) generateInFlightRef.current = null;
    }
  }, [caseId, refreshAfterMutation]);

  const submitResponse = useCallback(
    async (proposalId: string, decision: DecisionPropuesta) => {
      if (respondInFlightRef.current) return;
      const operation = {};
      respondInFlightRef.current = operation;
      mutationRevisionRef.current += 1;
      setRespondStatus('pending');
      try {
        const result = await negotiationService.submitOwnProposalResponse(caseId, proposalId, decision);
        if (!mountedRef.current || activeCaseIdRef.current !== caseId || respondInFlightRef.current !== operation) return;
        setResultCaseId(caseId);
        setState(result);
        setStatus('success');
        setRespondStatus('idle');
      } catch {
        if (mountedRef.current && activeCaseIdRef.current === caseId && respondInFlightRef.current === operation) {
          setRespondStatus('error');
        }
      } finally {
        if (respondInFlightRef.current === operation) respondInFlightRef.current = null;
      }
    },
    [caseId],
  );

  /** Call when opening a fresh confirmation dialog, so a previous attempt's error doesn't appear to already apply to this one. */
  const resetRespondStatus = useCallback(() => {
    setRespondStatus('idle');
  }, []);

  return {
    status: resultCaseId === caseId ? status : 'loading',
    state: resultCaseId === caseId ? state : undefined,
    reload,
    startRoundStatus,
    startNextRound,
    generateStatus,
    generateProposal,
    respondStatus,
    submitResponse,
    resetRespondStatus,
  };
}
