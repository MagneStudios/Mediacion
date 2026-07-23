import { useCallback, useEffect, useState } from 'react';

import { negotiationService } from '../../../services/negotiation.service';
import type { RoundHistoryItem } from '../../../types/negotiation';

export type UseRoundHistoryResult =
  | { status: 'loading'; items: undefined }
  | { status: 'error'; items: undefined; reload: () => void }
  | { status: 'empty'; items: [] }
  | { status: 'success'; items: RoundHistoryItem[] };

/** Read-only completed-round history for one case. */
export function useRoundHistory(caseId: string): UseRoundHistoryResult {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [items, setItems] = useState<RoundHistoryItem[]>([]);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    negotiationService
      .getRoundHistory(caseId)
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
