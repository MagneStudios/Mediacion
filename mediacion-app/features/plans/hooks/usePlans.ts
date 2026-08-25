import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { plansService } from '../../../services/plans.service';
import type { Plan } from '../../../types/plan';

export type UsePlansResult =
  | { status: 'loading'; plans: undefined }
  | { status: 'error'; plans: undefined; reload: () => void }
  | { status: 'empty'; plans: []; refresh: () => void }
  | { status: 'success'; plans: Plan[]; refresh: () => void };

/**
 * Full plan list — shared by the R-10 admin ABM (`app/admin/planes`) and
 * the R-09 party-facing checkout (`app/profile/plan`), both reading the
 * same `GET /planes`-backed service. Mirrors `useOwnPositions`'s shape: a
 * focus-triggered silent refresh picks up plans created/edited/deleted
 * elsewhere without re-flashing a loading state, and `refresh` is exposed
 * directly for an in-place mutation (delete, in the admin screen).
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
    plansService
      .listPlanes()
      .then((result) => {
        if (cancelled) return;
        setPlans(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
      })
      // A silent refresh that fails keeps the list already on screen: the user
      // did not ask for this read, so it must not replace a good catalog with
      // an error state. Only the visible load path (below) reports failure,
      // and it is the one with a retry. Mattered less while this was a mock
      // that never rejected; against `GET /planes` it is a dropped connection.
      .catch(() => {});
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
