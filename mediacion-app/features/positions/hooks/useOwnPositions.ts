import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { positionsService } from '../../../services/positions.service';
import type { PositionItem } from '../../../types/position';

export type UseOwnPositionsResult =
  | { status: 'loading'; items: undefined }
  | { status: 'error'; items: undefined; reload: () => void }
  | { status: 'empty'; items: []; refresh: () => void }
  | { status: 'success'; items: PositionItem[]; refresh: () => void };

/**
 * Own-position list for one case. Mirrors useCases(): a focus-triggered
 * silent refresh (never re-flashing a loading state once the first load has
 * completed) picks up items created or edited elsewhere in the same
 * session, e.g. returning from the create/edit/review screens. `refresh` is
 * exposed directly too, for an in-place mutation (delete) that doesn't
 * involve a navigation/focus transition.
 */
export function useOwnPositions(caseId: string): UseOwnPositionsResult {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [items, setItems] = useState<PositionItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    positionsService.getOwnPositions(caseId).then((result) => {
      if (cancelled) return;
      setItems(result);
      setStatus(result.length === 0 ? 'empty' : 'success');
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    positionsService
      .getOwnPositions(caseId)
      .then((result) => {
        if (cancelled) return;
        setItems(result);
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
  }, [caseId, attempt]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      return fetchSilently();
    }, [fetchSilently]),
  );

  const refresh = useCallback(() => {
    fetchSilently();
  }, [fetchSilently]);

  if (status === 'loading') return { status, items: undefined };
  if (status === 'error') return { status, items: undefined, reload };
  if (status === 'empty') return { status, items: [], refresh };
  return { status, items, refresh };
}
