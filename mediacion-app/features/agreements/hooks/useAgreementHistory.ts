import { useCallback, useEffect, useState } from 'react';

import { agreementsService } from '../../../services/agreements.service';
import type { AgreementHistoryItem } from '../../../types/agreement';

export type UseAgreementHistoryResult =
  | { status: 'loading'; items: undefined }
  | { status: 'error'; items: undefined; reload: () => void }
  | { status: 'empty'; items: [] }
  | { status: 'success'; items: AgreementHistoryItem[] };

/** Read-only agreement history for one case. */
export function useAgreementHistory(caseId: string): UseAgreementHistoryResult {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [items, setItems] = useState<AgreementHistoryItem[]>([]);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    agreementsService
      .getAgreementHistory(caseId)
      .then((result) => {
        if (cancelled) return;
        setItems(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, attempt]);

  if (status === 'loading') return { status, items: undefined };
  if (status === 'error') return { status, items: undefined, reload };
  if (status === 'empty') return { status, items: [] };
  return { status, items };
}
