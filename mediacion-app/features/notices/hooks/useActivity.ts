import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { activityService } from '../../../services/activity.service';
import type { ActivityListItem } from '../../../types/activity';

export type FetchStatus = 'loading' | 'error' | 'success';

/** Read-only shared activity feed. Mirrors useAgreementHistory()'s fetch/focus-refresh shape — no mutations exist on this hook. */
export function useActivity() {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [items, setItems] = useState<ActivityListItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    activityService.listActivity().then((result) => {
      if (cancelled) return;
      setItems(result);
      setStatus('success');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    activityService
      .listActivity()
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
  }, [attempt]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      return fetchSilently();
    }, [fetchSilently]),
  );

  return { status, items, reload };
}
