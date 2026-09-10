import { useCallback, useEffect, useRef, useState } from 'react';

import { agreementsService } from '../../../services/agreements.service';
import type { AgreementHistoryItem } from '../../../types/agreement';

export type UseAgreementHistoryResult =
  | { status: 'loading'; items: undefined }
  | { status: 'error'; items: undefined; reload: () => void }
  | { status: 'empty'; items: [] }
  | { status: 'success'; items: AgreementHistoryItem[] };

/** Read-only agreement history — of one acuerdo when the id is known, else of the case's. */
export function useAgreementHistory(caseId: string, agreementId?: string): UseAgreementHistoryResult {
  const key = agreementId ?? caseId;
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'success'>('loading');
  const [items, setItems] = useState<AgreementHistoryItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const activeKeyRef = useRef(key);
  const [resultKey, setResultKey] = useState<string | null>(null);

  if (activeKeyRef.current !== key) {
    activeKeyRef.current = key;
  }

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    agreementsService
      .getAgreementHistory(caseId, agreementId)
      .then((result) => {
        if (cancelled || activeKeyRef.current !== key) return;
        setResultKey(key);
        setItems(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
      })
      .catch(() => {
        if (cancelled || activeKeyRef.current !== key) return;
        setResultKey(key);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, agreementId, key, attempt]);

  if (resultKey !== key || status === 'loading') return { status: 'loading', items: undefined };
  if (status === 'error') return { status, items: undefined, reload };
  if (status === 'empty') return { status, items: [] };
  return { status, items };
}
