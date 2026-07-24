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

  const [startRoundStatus, setStartRoundStatus] = useState<MutationStatus>('idle');
  const [generateStatus, setGenerateStatus] = useState<MutationStatus>('idle');
  const [respondStatus, setRespondStatus] = useState<MutationStatus>('idle');

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    negotiationService.getNegotiationState(caseId).then((result) => {
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

  const startNextRound = useCallback(async () => {
    if (startRoundStatus === 'pending') return;
    setStartRoundStatus('pending');
    try {
      await negotiationService.startNextRound(caseId);
      setStartRoundStatus('idle');
      fetchSilently();
    } catch {
      setStartRoundStatus('error');
    }
  }, [caseId, startRoundStatus, fetchSilently]);

  const generateProposal = useCallback(async () => {
    if (generateStatus === 'pending') return;
    setGenerateStatus('pending');
    try {
      await negotiationService.generateSharedProposal(caseId);
      setGenerateStatus('idle');
      fetchSilently();
    } catch {
      setGenerateStatus('error');
    }
  }, [caseId, generateStatus, fetchSilently]);

  const submitResponse = useCallback(
    async (proposalId: string, decision: DecisionPropuesta) => {
      if (respondStatus === 'pending') return;
      setRespondStatus('pending');
      try {
        const result = await negotiationService.submitOwnProposalResponse(caseId, proposalId, decision);
        setState(result);
        setRespondStatus('idle');
      } catch {
        setRespondStatus('error');
      }
    },
    [caseId, respondStatus],
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
