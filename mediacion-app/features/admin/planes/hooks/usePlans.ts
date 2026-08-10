import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { plansService } from '../../../../services/plans.service';
import type { Plan } from '../../../../types/plan';

export type UsePlansResult =
  | { status: 'loading'; plans: undefined }
  | { status: 'error'; plans: undefined; reload: () => void }
  | { status: 'empty'; plans: []; refresh: () => void }
  | { status: 'success'; plans: Plan[]; refresh: () => void };

/**
 * R-10 admin plan list. Mirrors `useOwnPositions`'s shape: a focus-triggered
 * silent refresh picks up plans created/edited/deleted on the
 * create/edit screens without re-flashing a loading state, and `refresh` is
 * exposed directly for the in-place delete mutation.
 */
export function usePlans(): UsePlansResult {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    plansService.listPlanes().then((result) => {
      if (cancelled) return;
      setPlans(result);
      setStatus(result.length === 0 ? 'empty' : 'success');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    plansService
      .listPlanes()
      .then((result) => {
        if (cancelled) return;
        setPlans(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
        hasLoadedOnceRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      return fetchSilently();
    }, [fetchSilently]),
  );

  const refresh = useCallback(() => {
    fetchSilently();
  }, [fetchSilently]);

  if (status === 'loading') return { status, plans: undefined };
  if (status === 'error') return { status, plans: undefined, reload };
  if (status === 'empty') return { status, plans: [], refresh };
  return { status, plans, refresh };
}
