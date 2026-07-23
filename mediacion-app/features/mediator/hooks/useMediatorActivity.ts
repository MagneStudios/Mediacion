import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { mediatorService } from '../../../services/mediator.service';
import type { MediatorActivityItem } from '../../../types/mediator';

export type FetchStatus = 'loading' | 'error' | 'success';

/** Case-scoped mediator milestone feed. Mirrors useActivity()'s fetch/focus-refresh shape — read-only, no mutations. */
export function useMediatorActivity(caseId: string) {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [items, setItems] = useState<MediatorActivityItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    mediatorService.getMediatorActivity(caseId).then((result) => {
      if (cancelled) return;
      setItems(result);
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
    mediatorService
      .getMediatorActivity(caseId)
      .then((result) => {
        if (cancelled) return;
        setItems(result);
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

  return { status, items, reload };
}
