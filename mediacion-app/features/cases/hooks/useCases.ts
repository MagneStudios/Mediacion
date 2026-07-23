import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { casesService } from '../../../services/cases.service';
import type { CaseSummary } from '../../../types/case';

export type UseCasesResult =
  | { status: 'loading'; cases: undefined }
  | { status: 'error'; cases: undefined; reload: () => void }
  | { status: 'empty'; cases: [] }
  | { status: 'success'; cases: CaseSummary[] };

export function useCases(): UseCasesResult {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    casesService
      .listCases()
      .then((result) => {
        if (cancelled) return;
        setCases(result);
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

  // Silent refresh on focus: picks up cases created elsewhere in the same
  // session (see createCase in services/cases.service.ts) without flashing a
  // loading state over an already-populated dashboard. Skipped until the
  // first load has completed, and its dependency array never changes, so it
  // cannot loop or re-register repeatedly.
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      let cancelled = false;
      casesService.listCases().then((result) => {
        if (cancelled) return;
        setCases(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (status === 'loading') return { status, cases: undefined };
  if (status === 'error') return { status, cases: undefined, reload };
  if (status === 'empty') return { status, cases: [] };
  return { status, cases };
}
