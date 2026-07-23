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

  const [prepareStatus, setPrepareStatus] = useState<MutationStatus>('idle');
  const [signStatus, setSignStatus] = useState<MutationStatus>('idle');

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    agreementsService.getAgreementState(caseId).then((result) => {
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
    agreementsService
      .getAgreementState(caseId)
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

  const prepareDocument = useCallback(async () => {
    if (prepareStatus === 'pending') return;
    setPrepareStatus('pending');
    try {
      const result = await agreementsService.prepareSignatureDocument(caseId);
      setState(result);
      setPrepareStatus('idle');
    } catch {
      setPrepareStatus('error');
    }
  }, [caseId, prepareStatus]);

  const submitSignature = useCallback(
    async (agreementId: string) => {
      if (signStatus === 'pending') return;
      setSignStatus('pending');
      try {
        const result = await agreementsService.submitOwnMockSignature(caseId, agreementId);
        setState(result);
        setSignStatus('idle');
      } catch {
        setSignStatus('error');
      }
    },
    [caseId, signStatus],
  );

  const resetSignStatus = useCallback(() => {
    setSignStatus('idle');
  }, []);

  return {
    status,
    state,
    reload,
    prepareStatus,
    prepareDocument,
    signStatus,
    submitSignature,
    resetSignStatus,
  };
}
