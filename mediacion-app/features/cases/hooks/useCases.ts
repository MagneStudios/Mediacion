import { useCallback, useEffect, useState } from 'react';

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
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (status === 'loading') return { status, cases: undefined };
  if (status === 'error') return { status, cases: undefined, reload };
  if (status === 'empty') return { status, cases: [] };
  return { status, cases };
}
