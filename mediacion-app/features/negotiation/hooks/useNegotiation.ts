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
  const startRoundInFlightRef = useRef(false);
  const generateInFlightRef = useRef(false);
  const respondInFlightRef = useRef(false);

  const [startRoundStatus, setStartRoundStatus] = useState<MutationStatus>('idle');
  const [generateStatus, setGenerateStatus] = useState<MutationStatus>('idle');
  const [respondStatus, setRespondStatus] = useState<MutationStatus>('idle');

  useEffect(() => {
    activeCaseIdRef.current = caseId;
    startRoundInFlightRef.current = false;
    generateInFlightRef.current = false;
    respondInFlightRef.current = false;
    setStartRoundStatus('idle');
    setGenerateStatus('idle');
    setRespondStatus('idle');
    setState(undefined);
  }, [caseId]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    negotiationService
      .getNegotiationState(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setState(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
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
    negotiationService
      .getNegotiationState(caseId)
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

  const refreshAfterMutation = useCallback(async () => {
    try {
      const result = await negotiationService.getNegotiationState(caseId);
      if (activeCaseIdRef.current !== caseId) return false;
      setState(result);
      setStatus('success');
      return true;
    } catch {
      if (activeCaseIdRef.current === caseId) setStatus('error');
      return false;
    }
  }, [caseId]);

  const startNextRound = useCallback(async () => {
    if (startRoundInFlightRef.current) return;
    startRoundInFlightRef.current = true;
    setStartRoundStatus('pending');
    try {
      await negotiationService.startNextRound(caseId);
      if (await refreshAfterMutation()) setStartRoundStatus('idle');
    } catch {
      if (activeCaseIdRef.current === caseId) setStartRoundStatus('error');
    } finally {
      startRoundInFlightRef.current = false;
    }
  }, [caseId, refreshAfterMutation]);

  const generateProposal = useCallback(async () => {
    if (generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    setGenerateStatus('pending');
    try {
      await negotiationService.generateSharedProposal(caseId);
      if (await refreshAfterMutation()) setGenerateStatus('idle');
    } catch {
      if (activeCaseIdRef.current === caseId) setGenerateStatus('error');
    } finally {
      generateInFlightRef.current = false;
    }
  }, [caseId, refreshAfterMutation]);

  const submitResponse = useCallback(
    async (proposalId: string, decision: DecisionPropuesta) => {
      if (respondInFlightRef.current) return;
      respondInFlightRef.current = true;
      setRespondStatus('pending');
      try {
        const result = await negotiationService.submitOwnProposalResponse(caseId, proposalId, decision);
        if (activeCaseIdRef.current !== caseId) return;
        setState(result);
        setRespondStatus('idle');
      } catch {
        if (activeCaseIdRef.current === caseId) setRespondStatus('error');
      } finally {
        respondInFlightRef.current = false;
      }
    },
    [caseId],
  );

  /** Call when opening a fresh confirmation dialog, so a previous attempt's error doesn't appear to already apply to this one. */
  const resetRespondStatus = useCallback(() => {
    setRespondStatus('idle');
  }, []);

  return {
    status,
    state,
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
